/**
 * Social Media Publisher
 * Publishes approved content to X/Twitter and Meta (Facebook/Instagram)
 * 
 * Triggered when a content draft status changes to 'approved'
 */

import { createServiceClient } from '@/lib/supabase/client';
import { postToSlack, replyInThread } from '@/lib/slack/client';

import { TwitterApi } from 'twitter-api-v2';

// ============================================================
// X / TWITTER API v2
// ============================================================

interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

function getTwitterConfig(): TwitterConfig | null {
  if (!process.env.TWITTER_API_KEY) return null;
  return {
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  } as any;
}

/**
 * Post a tweet using X API v2
 * Uses OAuth 1.0a User Context for posting
 */
export async function postToTwitter(text: string): Promise<{ id: string; url: string } | null> {
  const config = getTwitterConfig();
  if (!config) {
    console.warn('[Twitter] API not configured, skipping publish');
    return null;
  }

  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });

    const v2Client = client.v2;
    const { data } = await v2Client.tweet(text);

    return {
      id: data.id,
      url: `https://x.com/ScottBottomsCO/status/${data.id}`,
    };
  } catch (err) {
    console.error('[Twitter] Post error:', err);
    return null;
  }
}

// ============================================================
// META / FACEBOOK + INSTAGRAM
// ============================================================

/**
 * Post to Facebook Page using Graph API
 */
export async function postToFacebook(message: string, link?: string): Promise<{ id: string; url: string } | null> {
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;

  if (!token || !pageId) {
    console.warn('[Facebook] API not configured, skipping publish');
    return null;
  }

  try {
    const body: Record<string, string> = {
      message,
      access_token: token,
    };
    if (link) body.link = link;

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[Facebook] Post failed:', err);
      return null;
    }

    const data = await res.json();
    return {
      id: data.id,
      url: `https://www.facebook.com/${data.id}`,
    };
  } catch (err) {
    console.error('[Facebook] Post error:', err);
    return null;
  }
}

/**
 * Post to Instagram using Graph API (requires Business account + linked FB Page)
 * Instagram API requires an image - text-only posts go through Facebook
 */
export async function postToInstagram(
  caption: string,
  imageUrl: string
): Promise<{ id: string } | null> {
  const token = process.env.META_ACCESS_TOKEN;
  const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!token || !igAccountId) {
    console.warn('[Instagram] API not configured, skipping publish');
    return null;
  }

  try {
    // Step 1: Create media container
    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: token,
        }),
      }
    );

    if (!containerRes.ok) return null;
    const container = await containerRes.json();

    // Step 2: Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: container.id,
          access_token: token,
        }),
      }
    );

    if (!publishRes.ok) return null;
    return publishRes.json();
  } catch (err) {
    console.error('[Instagram] Post error:', err);
    return null;
  }
}

// ============================================================
// UNIFIED PUBLISHER
// ============================================================

/**
 * Publish approved content to the target platform
 * Called when a draft status changes to 'approved'
 */
export async function publishContent(draftId: string) {
  const db = createServiceClient();

  const { data: draft, error } = await db
    .from('content_drafts')
    .select('*')
    .eq('id', draftId)
    .single();

  if (error || !draft) {
    console.error('[Publisher] Draft not found:', draftId);
    return;
  }

  if (draft.status !== 'approved') {
    console.warn('[Publisher] Draft not approved, skipping:', draftId);
    return;
  }

  let result: { id: string; url?: string } | null = null;
  const platform = draft.platform || draft.content_type?.replace('social_', '');

  try {
    switch (platform) {
      case 'twitter':
        const hashtags = (draft.hashtags || []).map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ');
        const tweetText = draft.body + (hashtags ? `\n\n${hashtags}` : '');
        result = await postToTwitter(tweetText);
        break;

      case 'facebook':
        result = await postToFacebook(draft.body);
        break;

      case 'instagram':
        // Instagram requires an image - skip if no visual asset
        if (draft.visual_direction) {
          console.warn('[Publisher] Instagram requires image URL, visual direction noted but no asset generated');
        }
        break;

      case 'email':
        // Email publishing goes through GHL, not social APIs
        // Handled by the email publisher separately
        console.log('[Publisher] Email publishing handled via GoHighLevel');
        break;

      default:
        console.warn('[Publisher] Unknown platform:', platform);
    }

    if (result) {
      // Update draft with published info
      await db
        .from('content_drafts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_url: result.url || '',
          published_post_id: result.id,
        })
        .eq('id', draftId);

      // Log to publishing_log
      await db.from('publishing_log').insert({
        tenant_id: draft.tenant_id,
        draft_id: draftId,
        platform,
        post_id: result.id,
        post_url: result.url || '',
        published_by: 'agent',
        distribution_channel: 'organic',
        status: 'published',
      });

      // Notify in Slack
      if (draft.slack_message_ts && draft.slack_channel) {
        await replyInThread(
          draft.slack_channel,
          draft.slack_message_ts,
          `:rocket: Published to ${platform}!${result.url ? ` <${result.url}|View Post>` : ''}`
        );
      }
    } else if (platform !== 'email') {
      // Update status to reflect publish failure
      await db
        .from('content_drafts')
        .update({ status: 'failed' })
        .eq('id', draftId);

      await db.from('publishing_log').insert({
        tenant_id: draft.tenant_id,
        draft_id: draftId,
        platform,
        published_by: 'agent',
        status: 'failed',
        error_message: `${platform} API not configured or publish failed`,
      });
    }
  } catch (err: any) {
    console.error('[Publisher] Error:', err);

    await db
      .from('content_drafts')
      .update({ status: 'failed' })
      .eq('id', draftId);

    await db.from('publishing_log').insert({
      tenant_id: draft.tenant_id,
      draft_id: draftId,
      platform,
      published_by: 'agent',
      status: 'failed',
      error_message: err.message,
    });
  }

  return result;
}

/**
 * Check which social platform APIs are configured
 */
export function getConfiguredPlatforms(): string[] {
  const platforms: string[] = [];
  if (process.env.TWITTER_API_KEY) platforms.push('twitter');
  if (process.env.META_ACCESS_TOKEN && process.env.META_PAGE_ID) platforms.push('facebook');
  if (process.env.META_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) platforms.push('instagram');
  return platforms;
}
