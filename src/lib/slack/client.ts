import { WebClient } from '@slack/web-api';
import { updateDraftStatus } from '@/lib/supabase/queries';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';
import { publishContent } from '@/lib/integrations/social-publisher';
import { runDailyBrief } from '@/lib/agents/daily-brief';
import { generateContent, generateRapidResponse } from '@/lib/agents/content-generator';
import { runSentimentAnalyzer } from '@/lib/agents/sentiment-analyzer';
import type { ContentType } from '@/types';

let slackClient: WebClient | null = null;

export function getSlackClient(): WebClient {
  if (!slackClient) {
    slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  }
  return slackClient;
}

/**
 * Post a message to a Slack channel
 */
export async function postToSlack(channel: string, text: string, blocks?: any[]) {
  try {
    const client = getSlackClient();
    const result = await client.chat.postMessage({
      channel,
      text,
      blocks,
      unfurl_links: false,
    });
    return result;
  } catch (error) {
    console.error('[Slack] Failed to post message:', error);
    return null;
  }
}

/**
 * Post a threaded reply
 */
export async function replyInThread(channel: string, threadTs: string, text: string) {
  try {
    const client = getSlackClient();
    return await client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text,
    });
  } catch (error) {
    console.error('[Slack] Failed to reply in thread:', error);
    return null;
  }
}

/**
 * Handle reaction events on content drafts
 */
export async function handleReaction(event: {
  reaction: string;
  user: string;
  item: { channel: string; ts: string };
}) {
  const { reaction, user, item } = event;
  const db = createServiceClient();

  // Find the draft linked to this Slack message
  const { data: draft } = await db
    .from('content_drafts')
    .select('*')
    .eq('slack_message_ts', item.ts)
    .eq('slack_channel', item.channel)
    .single();

  if (!draft) return;

  switch (reaction) {
    case '+1':        // 👍
    case 'thumbsup':
      await updateDraftStatus(draft.id, 'approved', { approved_by: user });
      await replyInThread(item.channel, item.ts, ':white_check_mark: Approved. Queuing for publish.');
      // Auto-publish to target platform
      publishContent(draft.id).catch(err =>
        console.error('[Slack] Auto-publish failed:', err)
      );
      break;

    case 'pencil2':   // ✏️
    case 'pencil':
      await updateDraftStatus(draft.id, 'revision_requested');
      await replyInThread(item.channel, item.ts, ':pencil2: Revision requested. Reply in this thread with your notes.');
      break;

    case 'x':         // ❌
      await updateDraftStatus(draft.id, 'rejected', { approved_by: user });
      await replyInThread(item.channel, item.ts, ':x: Rejected. Moving on.');
      break;

    case 'fire':      // 🔥
      await updateDraftStatus(draft.id, 'approved', { approved_by: user });
      await replyInThread(item.channel, item.ts, ':fire: Priority approved. Pushing to front of queue.');
      break;
  }
}

/**
 * Handle incoming messages in #sb-requests
 */
export async function handleRequestMessage(event: {
  text: string;
  user: string;
  channel: string;
  ts: string;
  files?: any[];
}) {
  const { text, user, channel, ts, files } = event;
  const lowerText = text.toLowerCase();

  // Route to appropriate handler
  if (files && files.length > 0) {
    // Video/file dropped -- route to video processing
    await replyInThread(channel, ts, ':movie_camera: Got it. Processing your file and generating content options. Stand by.');
    // TODO: trigger video processing agent
    return { type: 'video_processing', files };
  }

  if (lowerText.includes('email') || lowerText.includes('blast')) {
    await replyInThread(channel, ts, ':email: On it. Drafting email content now.');
    return { type: 'email', text };
  }

  if (lowerText.includes('sms') || lowerText.includes('text')) {
    await replyInThread(channel, ts, ':iphone: Got it. Drafting SMS content.');
    return { type: 'sms', text };
  }

  if (lowerText.includes('rapid') || lowerText.includes('response') || lowerText.includes('attack')) {
    await replyInThread(channel, ts, ':rotating_light: Rapid response mode activated. Generating options now.');
    generateRapidResponse('Ad-hoc rapid response from Slack', text, DEFAULT_TENANT)
      .catch(err => console.error('[Slack] rapid response failed:', err));
    return { type: 'rapid_response', text };
  }

  if (lowerText.includes('post') || lowerText.includes('social') || lowerText.includes('tweet')) {
    await replyInThread(channel, ts, ':speech_balloon: Generating social content options.');
    const platform = detectPlatform(text) || 'twitter';
    generateContent(
      `social_${platform}` as ContentType,
      text.substring(0, 200),
      'From Slack #sb-requests',
      DEFAULT_TENANT
    ).catch(err => console.error('[Slack] social draft failed:', err));
    return { type: 'social', text };
  }

  // Default: acknowledge and route
  await replyInThread(channel, ts, ':brain: Processing your request. I\'ll have something for you shortly.');
  return { type: 'general', text };
}

/**
 * Handle slash commands (/warbird).
 *
 * Slack requires an ACK within 3 seconds. We return the immediate ack text
 * and kick off the real work in the background. Agents post their own
 * follow-up messages to their canonical channels.
 */
export async function handleSlashCommand(command: string, args: string, _userId: string) {
  const tenantId = DEFAULT_TENANT;

  switch (command) {
    case 'brief':
      runDailyBrief(tenantId).catch(err => console.error('[SlashCommand] brief failed:', err));
      return { text: "Generating today's brief. It'll post to #sb-war-room in a moment." };

    case 'draft': {
      const topic = (args || '').trim();
      if (!topic) return { text: 'Usage: `/warbird draft <topic>` (e.g. `/warbird draft water policy in Grand Junction`)' };
      const platform = detectPlatform(args) || 'twitter';
      generateContent(
        `social_${platform}` as ContentType,
        topic,
        `Slack slash command from user`,
        tenantId
      ).catch(err => console.error('[SlashCommand] draft failed:', err));
      return { text: `Starting a ${platform} draft on "${topic}". I'll post it to #sb-content-queue for review.` };
    }

    case 'status': {
      const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
      return { text: base ? `Agent status: ${base}/agents` : 'Open /agents in the app to see live status.' };
    }

    case 'rapid': {
      const trigger = (args || '').trim();
      if (!trigger) return { text: 'Usage: `/warbird rapid <what happened>`' };
      generateRapidResponse(
        'Rapid response requested via Slack',
        trigger,
        tenantId
      ).catch(err => console.error('[SlashCommand] rapid failed:', err));
      return { text: `Rapid response mode activated for: "${trigger}". Options will land in #sb-war-room shortly.` };
    }

    case 'heatmap':
      runSentimentAnalyzer(tenantId).catch(err => console.error('[SlashCommand] heatmap failed:', err));
      return { text: 'Refreshing the issue heat map. New signals will show up in the dashboard and next brief.' };

    default:
      return { text: `Unknown command: ${command}. Try: brief, draft [topic], status, rapid [context], heatmap` };
  }
}

function detectPlatform(args: string): string | null {
  const lc = (args || '').toLowerCase();
  if (lc.includes('twitter') || lc.includes('tweet') || lc.includes(' x ')) return 'twitter';
  if (lc.includes('facebook') || lc.includes('fb')) return 'facebook';
  if (lc.includes('instagram') || lc.includes(' ig ')) return 'instagram';
  if (lc.includes('tiktok')) return 'tiktok';
  return null;
}
