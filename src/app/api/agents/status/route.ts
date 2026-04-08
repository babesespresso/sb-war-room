import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';

const AGENT_SCHEDULES: Record<string, { label: string; schedule: string; interval_hours: number }> = {
  competitor_monitor: { label: 'Competitor Monitor', schedule: 'Every 4 hours', interval_hours: 4 },
  news_pulse: { label: 'News Pulse', schedule: 'Every 2 hours', interval_hours: 2 },
  daily_brief: { label: 'Daily Brief', schedule: '6:30 AM MT', interval_hours: 24 },
  content_generator: { label: 'Content Generator', schedule: 'On demand', interval_hours: 0 },
  rapid_response: { label: 'Rapid Response', schedule: 'Triggered', interval_hours: 0 },
  sentiment_analyzer: { label: 'Sentiment Analyzer', schedule: 'Every 6 hours', interval_hours: 6 },
};

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') || process.env.DEFAULT_TENANT_ID || DEFAULT_TENANT;
  const period = request.nextUrl.searchParams.get('period') || '24h';
  const view = request.nextUrl.searchParams.get('view');

  const db = createServiceClient();
  const now = new Date();

  // Calculate period window
  const periodMatch = period.match(/^(\d+)(h|d)$/);
  const periodHours = periodMatch
    ? (periodMatch[2] === 'd' ? parseInt(periodMatch[1]) * 24 : parseInt(periodMatch[1]))
    : 24;
  const periodStart = new Date(now.getTime() - periodHours * 3600000).toISOString();

  try {
    // Fetch all runs within the period
    const { data: runs, error } = await db
      .from('agent_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('started_at', periodStart)
      .order('started_at', { ascending: false });

    if (error) throw error;

    // Also fetch the single latest run per agent (may be outside the period window)
    const { data: allRuns } = await db
      .from('agent_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(50);

    // ---- /api/agents/costs view ----
    if (view === 'costs') {
      const totalTokensInput = (runs || []).reduce((sum, r) => sum + (r.tokens_input || 0), 0);
      const totalTokensOutput = (runs || []).reduce((sum, r) => sum + (r.tokens_output || 0), 0);
      const totalCost = (runs || []).reduce((sum, r) => sum + (r.api_cost || 0), 0);

      const byAgent: Record<string, { name: string; tokens: number; cost: number; runs: number }> = {};
      for (const run of runs || []) {
        const name = run.agent_name;
        if (!byAgent[name]) byAgent[name] = { name, tokens: 0, cost: 0, runs: 0 };
        byAgent[name].tokens += (run.tokens_input || 0) + (run.tokens_output || 0);
        byAgent[name].cost += run.api_cost || 0;
        byAgent[name].runs += 1;
      }

      return NextResponse.json({
        period,
        total_tokens_input: totalTokensInput,
        total_tokens_output: totalTokensOutput,
        total_cost: totalCost,
        by_agent: Object.values(byAgent),
      });
    }

    // ---- Default: /api/agents/status view ----
    const agents = Object.entries(AGENT_SCHEDULES).map(([name, config]) => {
      const agentRuns = (allRuns || []).filter(r => r.agent_name === name);
      const lastRun = agentRuns[0] || null;
      const periodRuns = (runs || []).filter(r => r.agent_name === name);

      // Calculate items processed and tokens used within the period
      const items_processed_today = periodRuns.reduce((sum, r) => sum + (r.items_processed || 0), 0);
      const tokens_used_today = periodRuns.reduce((sum, r) => sum + (r.tokens_input || 0) + (r.tokens_output || 0), 0);
      const cost_today = periodRuns.reduce((sum, r) => sum + (r.api_cost || 0), 0);
      const runs_today = periodRuns.length;

      // Determine status
      let status: 'idle' | 'running' | 'completed' | 'failed' | 'overdue' = 'idle';
      if (lastRun) {
        if (lastRun.status === 'running') {
          status = 'running';
        } else if (lastRun.status === 'failed') {
          status = 'failed';
        } else if (lastRun.status === 'completed') {
          // Check if overdue based on schedule
          if (config.interval_hours > 0) {
            const timeSinceLast = (now.getTime() - new Date(lastRun.completed_at || lastRun.started_at).getTime()) / 3600000;
            status = timeSinceLast > config.interval_hours * 1.5 ? 'overdue' : 'completed';
          } else {
            status = 'completed';
          }
        }
      }

      // Calculate next scheduled run
      let next_scheduled_run: string | null = null;
      if (config.interval_hours > 0 && lastRun?.completed_at) {
        const nextRun = new Date(new Date(lastRun.completed_at).getTime() + config.interval_hours * 3600000);
        next_scheduled_run = nextRun.toISOString();
      }

      return {
        name,
        label: config.label,
        schedule: config.schedule,
        status,
        last_run: lastRun ? {
          id: lastRun.id,
          status: lastRun.status,
          started_at: lastRun.started_at,
          completed_at: lastRun.completed_at,
          items_processed: lastRun.items_processed,
          tokens_input: lastRun.tokens_input,
          tokens_output: lastRun.tokens_output,
          api_cost: lastRun.api_cost,
          error_message: lastRun.error_message,
        } : null,
        next_scheduled_run,
        items_processed_today,
        tokens_used_today,
        cost_today,
        runs_today,
      };
    });

    // Overall summary
    const totalCost = agents.reduce((sum, a) => sum + a.cost_today, 0);
    const totalTokens = agents.reduce((sum, a) => sum + a.tokens_used_today, 0);
    const totalRuns = agents.reduce((sum, a) => sum + a.runs_today, 0);

    return NextResponse.json({
      period,
      summary: {
        total_cost: totalCost,
        total_tokens: totalTokens,
        total_runs: totalRuns,
        healthy: agents.filter(a => a.status === 'completed' || a.status === 'idle').length,
        overdue: agents.filter(a => a.status === 'overdue').length,
        failed: agents.filter(a => a.status === 'failed').length,
      },
      agents,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
