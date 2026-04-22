import { NextRequest, NextResponse } from 'next/server';
import { runCompetitorMonitor } from '@/lib/agents/competitor-monitor';
import { runDailyBrief } from '@/lib/agents/daily-brief';
import { runNewsPulse } from '@/lib/agents/news-pulse';
import { runSentimentAnalyzer } from '@/lib/agents/sentiment-analyzer';
import { runPerformanceTracker } from '@/lib/agents/performance-tracker';
import { DEFAULT_TENANT } from '@/lib/supabase/client';

// Vercel Cron: schedule in vercel.json
// This endpoint is called by Vercel Cron or an external scheduler

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agent = request.nextUrl.searchParams.get('agent');
  const tenantId = request.nextUrl.searchParams.get('tenant') || DEFAULT_TENANT;

  try {
    switch (agent) {
      case 'competitor_monitor':
        const monitorResult = await runCompetitorMonitor(tenantId);
        return NextResponse.json({ success: true, agent, ...monitorResult });

      case 'news_pulse':
        const newsResult = await runNewsPulse(tenantId);
        return NextResponse.json({ success: true, agent, ...newsResult });

      case 'daily_brief':
        const briefResult = await runDailyBrief(tenantId);
        return NextResponse.json({ success: true, agent, briefId: briefResult.briefId });

      case 'sentiment_analyzer':
        const sentimentResult = await runSentimentAnalyzer(tenantId);
        return NextResponse.json({ success: true, agent, ...sentimentResult });

      case 'performance_tracker':
        const perfResult = await runPerformanceTracker(tenantId);
        return NextResponse.json({ success: true, agent, ...perfResult });

      case 'all':
        // Run all scheduled agents in sequence. Order matters: ingest raw data
        // first (news + competitor), then derive (sentiment), then summarize (brief).
        // performance_tracker is independent and runs last.
        const results: Record<string, any> = {};

        try {
          results.news_pulse = await runNewsPulse(tenantId);
        } catch (e: any) {
          results.news_pulse = { error: e.message };
        }

        try {
          results.competitor_monitor = await runCompetitorMonitor(tenantId);
        } catch (e: any) {
          results.competitor_monitor = { error: e.message };
        }

        try {
          results.sentiment_analyzer = await runSentimentAnalyzer(tenantId);
        } catch (e: any) {
          results.sentiment_analyzer = { error: e.message };
        }

        try {
          results.performance_tracker = await runPerformanceTracker(tenantId);
        } catch (e: any) {
          results.performance_tracker = { error: e.message };
        }

        try {
          results.daily_brief = await runDailyBrief(tenantId);
        } catch (e: any) {
          results.daily_brief = { error: e.message };
        }

        return NextResponse.json({ success: true, results });

      default:
        return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error(`[Cron] Agent ${agent} failed:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
