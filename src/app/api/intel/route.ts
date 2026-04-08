import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestBrief, getCompetitors, getCompetitorActivities,
  getNewsItems, getSentimentSignals, getHeatMap, getDashboardStats,
  getPositions
} from '@/lib/supabase/queries';
import { DEFAULT_TENANT } from '@/lib/supabase/client';

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
        const stats = await getDashboardStats(tenant);
        
        try {
          const { getXAnalytics } = await import('@/lib/scrapers/twitter');
          const socialData = await getXAnalytics();
          if (socialData.connected && socialData.stats) {
            // Add real absolute followers metric
            (stats as any).totalFollowers = socialData.stats.followers;
          }
        } catch (e) {
          console.error('Failed to augment with Twitter API natively', e);
        }
        
        return NextResponse.json(stats);
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

      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
