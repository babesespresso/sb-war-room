/**
 * Competitor Social Media Scraper
 * Uses X API v2 and Meta Graph API to monitor competitor accounts
 * Falls back to web scraping for platforms without API access
 */

import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';

// ============================================================
// X / TWITTER SCRAPER (API v2)
// ============================================================

/**
 * Fetch recent tweets from a competitor's account
 * Uses X API v2 with Bearer token (app-only auth)
 */
export async function scrapeTwitterAccount(
  handle: string,
  sinceId?: string,
  maxResults = 10
): Promise<any[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN || process.env.TWITTER_API_KEY;
  if (!bearerToken) {
    console.warn('[TwitterScraper] No bearer token configured');
    return [];
  }

  try {
    // First, get user ID from handle
    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${handle}`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
      }
    );

    if (!userRes.ok) {
      console.error(`[TwitterScraper] Failed to look up @${handle}: ${userRes.status}`);
      return [];
    }

    const userData = await userRes.json();
    const userId = userData.data?.id;
    if (!userId) return [];

    // Fetch recent tweets
    let url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics,referenced_tweets,entities&expansions=referenced_tweets.id`;
    if (sinceId) url += `&since_id=${sinceId}`;

    const tweetsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (!tweetsRes.ok) {
      console.error(`[TwitterScraper] Failed to fetch tweets for @${handle}: ${tweetsRes.status}`);
      return [];
    }

    const tweetsData = await tweetsRes.json();

    return (tweetsData.data || []).map((tweet: any) => ({
      platform: 'twitter',
      handle,
      post_id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      metrics: tweet.public_metrics || {},
      is_retweet: tweet.referenced_tweets?.some((r: any) => r.type === 'retweeted') || false,
      is_reply: tweet.referenced_tweets?.some((r: any) => r.type === 'replied_to') || false,
      url: `https://x.com/${handle}/status/${tweet.id}`,
    }));
  } catch (err) {
    console.error(`[TwitterScraper] Error scraping @${handle}:`, err);
    return [];
  }
}

// ============================================================
// META / FACEBOOK SCRAPER (Graph API)
// ============================================================

/**
 * Fetch recent posts from a competitor's Facebook page
 * Requires a valid access token with pages_read_engagement permission
 */
export async function scrapeFacebookPage(
  pageId: string,
  limit = 10
): Promise<any[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    console.warn('[FacebookScraper] No access token configured');
    return [];
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/posts?fields=message,created_time,shares,reactions.summary(true),comments.summary(true)&limit=${limit}&access_token=${token}`
    );

    if (!res.ok) {
      console.error(`[FacebookScraper] Failed to fetch page ${pageId}: ${res.status}`);
      return [];
    }

    const data = await res.json();

    return (data.data || []).map((post: any) => ({
      platform: 'facebook',
      page_id: pageId,
      post_id: post.id,
      text: post.message || '',
      created_at: post.created_time,
      metrics: {
        reactions: post.reactions?.summary?.total_count || 0,
        comments: post.comments?.summary?.total_count || 0,
        shares: post.shares?.count || 0,
      },
      url: `https://www.facebook.com/${post.id}`,
    }));
  } catch (err) {
    console.error(`[FacebookScraper] Error scraping page ${pageId}:`, err);
    return [];
  }
}

// ============================================================
// UNIFIED COMPETITOR SCRAPER
// ============================================================

/**
 * Scrape all configured social accounts for all active competitors
 * Returns raw posts ready for analysis by the Competitor Monitor agent
 */
export async function scrapeAllCompetitors(tenantId = DEFAULT_TENANT) {
  const db = createServiceClient();

  const { data: competitors } = await db
    .from('competitors')
    .select('id, name, social_accounts')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (!competitors) return [];

  const allPosts: any[] = [];

  for (const competitor of competitors) {
    const accounts = competitor.social_accounts || {};

    // Scrape Twitter/X
    if (accounts.twitter_handle) {
      const tweets = await scrapeTwitterAccount(accounts.twitter_handle);
      for (const tweet of tweets) {
        // Skip retweets and replies for now
        if (tweet.is_retweet || tweet.is_reply) continue;

        // Check if we already have this post
        const { data: existing } = await db
          .from('competitor_activities')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('source_url', tweet.url)
          .single();

        if (!existing) {
          await db.from('competitor_activities').insert({
            tenant_id: tenantId,
            competitor_id: competitor.id,
            activity_type: 'social_post',
            platform: 'twitter',
            raw_content: tweet.text,
            source_url: tweet.url,
            engagement_metrics: tweet.metrics,
            detected_at: tweet.created_at || new Date().toISOString(),
          });
          allPosts.push({ ...tweet, competitor_name: competitor.name });
        }
      }
    }

    // Scrape Twitter/X campaign account if different
    if (accounts.twitter_campaign && accounts.twitter_campaign !== accounts.twitter_handle) {
      const campaignTweets = await scrapeTwitterAccount(accounts.twitter_campaign);
      for (const tweet of campaignTweets) {
        if (tweet.is_retweet || tweet.is_reply) continue;

        const { data: existing } = await db
          .from('competitor_activities')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('source_url', tweet.url)
          .single();

        if (!existing) {
          await db.from('competitor_activities').insert({
            tenant_id: tenantId,
            competitor_id: competitor.id,
            activity_type: 'social_post',
            platform: 'twitter',
            raw_content: tweet.text,
            source_url: tweet.url,
            engagement_metrics: tweet.metrics,
            detected_at: tweet.created_at || new Date().toISOString(),
          });
          allPosts.push({ ...tweet, competitor_name: competitor.name });
        }
      }
    }

    // Scrape Facebook
    if (accounts.facebook_page) {
      const fbPosts = await scrapeFacebookPage(accounts.facebook_page);
      for (const post of fbPosts) {
        if (!post.text) continue;

        const { data: existing } = await db
          .from('competitor_activities')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('source_url', post.url)
          .single();

        if (!existing) {
          await db.from('competitor_activities').insert({
            tenant_id: tenantId,
            competitor_id: competitor.id,
            activity_type: 'social_post',
            platform: 'facebook',
            raw_content: post.text,
            source_url: post.url,
            engagement_metrics: post.metrics,
            detected_at: post.created_at || new Date().toISOString(),
          });
          allPosts.push({ ...post, competitor_name: competitor.name });
        }
      }
    }

    // Rate limiting: wait between competitors
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return allPosts;
}
