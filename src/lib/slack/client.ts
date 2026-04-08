import { WebClient } from '@slack/web-api';
import { updateDraftStatus } from '@/lib/supabase/queries';
import { createServiceClient } from '@/lib/supabase/client';
import { publishContent } from '@/lib/integrations/social-publisher';

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
    return { type: 'rapid_response', text };
  }

  if (lowerText.includes('post') || lowerText.includes('social') || lowerText.includes('tweet')) {
    await replyInThread(channel, ts, ':speech_balloon: Generating social content options.');
    return { type: 'social', text };
  }

  // Default: acknowledge and route
  await replyInThread(channel, ts, ':brain: Processing your request. I\'ll have something for you shortly.');
  return { type: 'general', text };
}

/**
 * Handle slash commands (/warbird)
 */
export async function handleSlashCommand(command: string, args: string, userId: string) {
  switch (command) {
    case 'brief':
      return { text: 'Generating today\'s brief. It\'ll post to #sb-war-room in a moment.' };
    case 'draft':
      return { text: `Starting a draft on "${args}". I'll post it to #sb-content-queue for review.` };
    case 'status':
      return { text: 'Checking agent status... (pulling from system)' };
    case 'rapid':
      return { text: `Rapid response mode activated for: "${args}". Stand by.` };
    case 'heatmap':
      return { text: 'Generating issue heat map. Posting to #sb-war-room.' };
    default:
      return { text: `Unknown command: ${command}. Try: brief, draft [topic], status, rapid [context], heatmap` };
  }
}
