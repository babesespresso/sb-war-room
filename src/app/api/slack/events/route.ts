import { NextRequest, NextResponse } from 'next/server';
import { handleReaction, handleRequestMessage, handleSlashCommand } from '@/lib/slack/client';
import { generateContent, generateRapidResponse } from '@/lib/agents/content-generator';
import { runDailyBrief } from '@/lib/agents/daily-brief';
import crypto from 'crypto';

// Verify Slack request signature
function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET!)
    .update(sigBasestring)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-slack-request-timestamp') || '';
  const signature = request.headers.get('x-slack-signature') || '';

  // Verify signature in production
  if (process.env.NODE_ENV === 'production' && process.env.SLACK_SIGNING_SECRET) {
    if (!verifySlackSignature(rawBody, timestamp, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const body = JSON.parse(rawBody);

  // Handle Slack URL verification challenge
  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Handle events
  if (body.type === 'event_callback') {
    const event = body.event;

    // Don't process bot messages
    if (event.bot_id) {
      return NextResponse.json({ ok: true });
    }

    switch (event.type) {
      case 'reaction_added':
        await handleReaction({
          reaction: event.reaction,
          user: event.user,
          item: event.item,
        });
        break;

      case 'message':
        // Handle messages in #sb-requests
        if (event.channel === process.env.SLACK_CHANNEL_REQUESTS) {
          const routed = await handleRequestMessage({
            text: event.text || '',
            user: event.user,
            channel: event.channel,
            ts: event.ts,
            files: event.files,
          });

          // Trigger appropriate agent based on routing
          if (routed) {
            try {
              switch (routed.type) {
                case 'social':
                  await generateContent('social_twitter', routed.text || '', routed.text || '');
                  break;
                case 'rapid_response':
                  await generateRapidResponse(routed.text || '', routed.text || '');
                  break;
                // email, sms, video_processing handled by respective agents
              }
            } catch (err) {
              console.error('[Slack] Agent trigger failed:', err);
            }
          }
        }

        // Handle @warbird mentions
        if (event.type === 'app_mention') {
          const text = (event.text || '').toLowerCase();
          if (text.includes('brief')) {
            await runDailyBrief();
          } else if (text.includes('draft')) {
            const topic = text.replace(/<@[^>]+>/g, '').replace('draft', '').trim();
            await generateContent('social_twitter', topic, topic);
          }
        }
        break;
    }
  }

  return NextResponse.json({ ok: true });
}
