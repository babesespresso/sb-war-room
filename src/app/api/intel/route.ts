import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestBrief, getCompetitors, getCompetitorActivities,
  getNewsItems, getSentimentSignals, getHeatMap, getDashboardStats,
  getPositions
} from '@/lib/supabase/queries';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';

/**
 * Report when each feedback loop last produced data so the UI can show
 * staleness instead of silently rendering old numbers.
 */
async function getFreshness(tenantId: string) {
  const db = createServiceClient();
  const [news, competitor, sentiment, metrics, brief, lastRuns] = await Promise.all([
    db.from('news_items').select('published_at').eq('tenant_id', tenantId)
      .order('published_at', { ascending: false }).limit(1),
    db.from('competitor_activities').select('detected_at').eq('tenant_id', tenantId)
      .order('detected_at', { ascending: false }).limit(1),
    db.from('sentiment_signals').select('period_end').eq('tenant_id', tenantId)
      .order('period_end', { ascending: false }).limit(1),
    db.from('performance_metrics').select('metric_date').eq('tenant_id', tenantId)
      .order('metric_date', { ascending: false }).limit(1),
    db.from('daily_briefs').select('brief_date').eq('tenant_id', tenantId)
      .order('brief_date', { ascending: false }).limit(1),
    db.from('agent_runs').select('agent_name, completed_at, status')
      .eq('tenant_id', tenantId).eq('status', 'completed')
      .order('completed_at', { ascending: false }).limit(100),
  ]);

  const lastByAgent: Record<string, string | null> = {};
  for (const r of (lastRuns.data || []) as any[]) {
    if (!lastByAgent[r.agent_name]) lastByAgent[r.agent_name] = r.completed_at;
  }

  const now = Date.now();
  const ageMinutes = (ts?: string | null) =>
    ts ? Math.round((now - new Date(ts).getTime()) / 60000) : null;

  return {
    now: new Date().toISOString(),
    news_last_published_at: news.data?.[0]?.published_at || null,
    competitor_last_detected_at: competitor.data?.[0]?.detected_at || null,
    sentiment_last_period_end: sentiment.data?.[0]?.period_end || null,
    metrics_last_date: metrics.data?.[0]?.metric_date || null,
    brief_last_date: brief.data?.[0]?.brief_date || null,
    last_run_by_agent: lastByAgent,
    age_minutes: {
      news: ageMinutes(news.data?.[0]?.published_at),
      competitor: ageMinutes(competitor.data?.[0]?.detected_at),
      sentiment: ageMinutes(sentiment.data?.[0]?.period_end),
      news_pulse: ageMinutes(lastByAgent.news_pulse),
      competitor_monitor: ageMinutes(lastByAgent.competitor_monitor),
      sentiment_analyzer: ageMinutes(lastByAgent.sentiment_analyzer),
      performance_tracker: ageMinutes(lastByAgent.performance_tracker),
      daily_brief: ageMinutes(lastByAgent.daily_brief),
    },
  };
}

/**
 * Compose a live ticker feed from recent news, competitor activity,
 * latest brief, and approved drafts. Each item is tagged so the TopBar
 * can color-code it.
 */
async function getTicker(tenantId: string) {
  const db = createServiceClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [news, acts, brief, approved, heat] = await Promise.all([
    db.from('news_items').select('headline, source_name, source_url, published_at, relevance_score')
      .eq('tenant_id', tenantId).gte('published_at', since)
      .order('relevance_score', { ascending: false }).limit(4),
    db.from('competitor_activities').select('summary, raw_content, threat_level, detected_at, competitor:competitors(name)')
      .eq('tenant_id', tenantId).gte('detected_at', since)
      .in('threat_level', ['critical', 'high'])
      .order('detected_at', { ascending: false }).limit(3),
    db.from('daily_briefs').select('brief_date').eq('tenant_id', tenantId)
      .order('brief_date', { ascending: false }).limit(1),
    db.from('content_drafts').select('body, status, updated_at')
      .eq('tenant_id', tenantId).in('status', ['approved', 'published'])
      .gte('updated_at', since).order('updated_at', { ascending: false }).limit(2),
    db.from('sentiment_signals').select('topic, velocity, opportunity_score')
      .eq('tenant_id', tenantId).gte('opportunity_score', 60)
      .order('velocity', { ascending: false }).limit(2),
  ]);

  const items: { tag: string; text: string }[] = [];

  if (brief.data?.[0]) {
    items.push({ tag: 'BRIEF', text: `Daily brief published ${brief.data[0].brief_date}` });
  }
  for (const n of (news.data || []) as any[]) {
    items.push({ tag: 'INTEL', text: `${n.headline} — ${n.source_name || 'news'}` });
  }
  for (const a of (acts.data || []) as any[]) {
    const name = a.competitor?.name || 'competitor';
    const snip = (a.summary || a.raw_content || '').toString().slice(0, 120);
    items.push({ tag: 'ALERT', text: `${name}: ${snip}` });
  }
  for (const d of (approved.data || []) as any[]) {
    items.push({ tag: 'WIN', text: `Draft ${d.status}: "${String(d.body).slice(0, 80)}…"` });
  }
  for (const h of (heat.data || []) as any[]) {
    const dir = h.velocity > 0 ? '+' : '';
    items.push({ tag: 'HEAT', text: `${h.topic} trending (velocity ${dir}${h.velocity}, opportunity ${h.opportunity_score})` });
  }

  if (items.length === 0) {
    items.push({ tag: 'BRIEF', text: 'Awaiting first intelligence cycle — cron jobs running every 2–6h' });
  }
  return items;
}

function getTenant(req: NextRequest) {
  return req.headers.get('x-tenant-id') || DEFAULT_TENANT;
}

// GET /api/intel?type=brief|competitors|activities|news|sentiment|heatmap|dashboard
export async function GET(request: NextRequest) {
  const tenant = getTenant(request);
  const type = request.nextUrl.searchParams.get('type') || 'dashboard';

  try {
    switch (type) {
      case 'dashboard': {
        const [stats, freshness] = await Promise.all([
          getDashboardStats(tenant),
          getFreshness(tenant),
        ]);

        let socialHealth: { connected: boolean; engagementSource?: string; engagementError?: string | null } = { connected: false };
        try {
          const { getXAnalytics } = await import('@/lib/scrapers/twitter');
          const socialData: any = await getXAnalytics();
          if (socialData.connected && socialData.stats) {
            (stats as any).totalFollowers = socialData.stats.followers;
            socialHealth = {
              connected: true,
              engagementSource: socialData.engagementSource,
              engagementError: socialData.engagementError,
            };
          }
        } catch (e) {
          console.error('Failed to augment with Twitter API natively', e);
        }

        return NextResponse.json({ ...stats, freshness, socialHealth });
      }

      case 'brief':
        return NextResponse.json(await getLatestBrief(tenant));

      case 'competitors':
        return NextResponse.json(await getCompetitors(tenant));

      case 'activities': {
        const competitorId = request.nextUrl.searchParams.get('competitor_id') || undefined;
        const since = request.nextUrl.searchParams.get('since') || undefined;
        const threat = request.nextUrl.searchParams.get('threat') as any;
        return NextResponse.json(await getCompetitorActivities(tenant, {
          competitorId, since, threatLevel: threat, limit: 50
        }));
      }

      case 'news': {
        const topic = request.nextUrl.searchParams.get('topic') || undefined;
        const minRelevance = parseInt(request.nextUrl.searchParams.get('min_relevance') || '0') || undefined;
        const responseOnly = request.nextUrl.searchParams.get('response_only') === 'true';
        return NextResponse.json(await getNewsItems(tenant, { topic, minRelevance, responseOnly }));
      }

      case 'sentiment':
        const sTopic = request.nextUrl.searchParams.get('topic') || undefined;
        return NextResponse.json(await getSentimentSignals(tenant, { topic: sTopic }));

      case 'heatmap':
        return NextResponse.json(await getHeatMap(tenant));

      case 'ticker':
        return NextResponse.json(await getTicker(tenant));

      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
