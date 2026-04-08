import { NextRequest, NextResponse } from 'next/server';
import { runDailyBrief } from '@/lib/agents/daily-brief';
import { generateContent, generateRapidResponse } from '@/lib/agents/content-generator';
import { generateEmail } from '@/lib/agents/email-content';
import { postToSlack } from '@/lib/slack/client';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const command = formData.get('command') as string;
  const text = (formData.get('text') as string || '').trim();
  const userId = formData.get('user_id') as string;
  const channelId = formData.get('channel_id') as string;

  // Parse subcommand
  const parts = text.split(' ');
  const subcommand = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).join(' ');

  // Acknowledge immediately (Slack requires response within 3s)
  // Then process async
  switch (subcommand) {
    case 'brief':
      // Fire and forget - will post to war room
      runDailyBrief().catch(err =>
        console.error('[SlashCommand] Brief generation failed:', err)
      );
      return NextResponse.json({
        response_type: 'ephemeral',
        text: ':sunrise: Generating daily brief. It will post to #sb-war-room when ready.',
      });

    case 'draft':
      if (!args) {
        return NextResponse.json({
          response_type: 'ephemeral',
          text: 'Usage: `/warbird draft <topic>` -- e.g. `/warbird draft water policy response`',
        });
      }
      generateContent('social_twitter', args, args).catch(err =>
        console.error('[SlashCommand] Draft generation failed:', err)
      );
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `:memo: Drafting content about "${args}". It will post to #sb-content-queue for review.`,
      });

    case 'email':
      if (!args) {
        return NextResponse.json({
          response_type: 'ephemeral',
          text: 'Usage: `/warbird email <topic>` -- e.g. `/warbird email water policy announcement`',
        });
      }
      generateEmail(args, args).catch(err =>
        console.error('[SlashCommand] Email generation failed:', err)
      );
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `:email: Drafting email about "${args}". It will post to #sb-content-queue for review.`,
      });

    case 'rapid':
      if (!args) {
        return NextResponse.json({
          response_type: 'ephemeral',
          text: 'Usage: `/warbird rapid <trigger description>` -- e.g. `/warbird rapid Kirkmeyer attacked our water position`',
        });
      }
      generateRapidResponse(args, args).catch(err =>
        console.error('[SlashCommand] Rapid response failed:', err)
      );
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `:rotating_light: Rapid response mode activated for: "${args}". Options will post to #sb-war-room.`,
      });

    case 'status':
      // Quick status check
      return NextResponse.json({
        response_type: 'ephemeral',
        text: ':brain: *Warbird Status*\nAll systems operational. Use the dashboard at /agents for detailed agent status and run history.',
      });

    case 'heatmap':
      postToSlack(
        process.env.SLACK_CHANNEL_WAR_ROOM!,
        ':fire: Issue heat map requested. Generating from latest sentiment data...'
      ).catch(console.error);
      return NextResponse.json({
        response_type: 'ephemeral',
        text: ':fire: Heat map will post to #sb-war-room.',
      });

    case 'help':
    case '':
      return NextResponse.json({
        response_type: 'ephemeral',
        text:
          ':zap: *Warbird Commands*\n\n' +
          '`/warbird brief` -- Generate today\'s daily brief\n' +
          '`/warbird draft <topic>` -- Create a social media draft\n' +
          '`/warbird email <topic>` -- Create an email campaign draft\n' +
          '`/warbird rapid <trigger>` -- Trigger rapid response (3 variants)\n' +
          '`/warbird status` -- Check system status\n' +
          '`/warbird heatmap` -- Post issue heat map\n' +
          '`/warbird help` -- Show this message',
      });

    default:
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Unknown command: "${subcommand}". Try \`/warbird help\` for available commands.`,
      });
  }
}
