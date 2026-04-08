import { NextResponse } from 'next/server';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export async function GET() {
  try {
    const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
    const credString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    if (!propertyId || !credString) {
      return NextResponse.json({ error: "Analytics API not configured" }, { status: 500 });
    }

    let credentials;
    try {
      credentials = JSON.parse(credString);
    } catch(e) {
      credentials = JSON.parse(credString.replace(/\\n/g, '\n'));
    }

    const privateKey = credentials.private_key ? credentials.private_key.replace(/\\n/g, '\n') : '';

    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: privateKey,
      },
      projectId: credentials.project_id
    });

    const prop = `properties/${propertyId}`;

    // Run all queries in parallel for speed
    const [
      [realtimeResponse],
      [dailyResponse],
      [hourlyResponse],
      [sourceResponse],
      [geoResponse],
      [engagementResponse],
    ] = await Promise.all([
      // 1. Realtime active users
      analyticsDataClient.runRealtimeReport({
        property: prop,
        metrics: [{ name: 'activeUsers' }],
      }),

      // 2. 24h metrics (users, bounce rate, sessions, avg session duration, pages/session)
      analyticsDataClient.runReport({
        property: prop,
        dateRanges: [{ startDate: '1daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'bounceRate' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'screenPageViewsPerSession' },
          { name: 'screenPageViews' },
        ],
      }),

      // 3. Hourly traffic breakdown (users + sessions + pageviews)
      analyticsDataClient.runReport({
        property: prop,
        dateRanges: [{ startDate: '1daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'hour' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
      }),

      // 4. Acquisition Sources (7 days)
      analyticsDataClient.runReport({
        property: prop,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 6,
      }),

      // 5. Geographic breakdown by region (state) — 7 day window for richer data
      analyticsDataClient.runReport({
        property: prop,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'region' }, { name: 'country' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),

      // 6. Engagement: top pages (7 days)
      analyticsDataClient.runReport({
        property: prop,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 5,
      }),
    ]);

    // --- Parse responses ---

    const liveUsers = parseInt(realtimeResponse.rows?.[0]?.metricValues?.[0]?.value || '0', 10);

    const dailyRow = dailyResponse.rows?.[0];
    const totalVisitors = parseInt(dailyRow?.metricValues?.[0]?.value || '0', 10);
    const bounceRate = (Number(dailyRow?.metricValues?.[1]?.value || 0) * 100).toFixed(1);
    const totalSessions24h = parseInt(dailyRow?.metricValues?.[2]?.value || '0', 10);
    const avgSessionDuration = Math.round(Number(dailyRow?.metricValues?.[3]?.value || 0)); // seconds
    const pagesPerSession = Number(dailyRow?.metricValues?.[4]?.value || 0).toFixed(1);
    const totalPageViews24h = parseInt(dailyRow?.metricValues?.[5]?.value || '0', 10);

    // Hourly breakdown — enriched
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      users: 0,
      sessions: 0,
      pageViews: 0,
    }));
    if (hourlyResponse.rows) {
      hourlyResponse.rows.forEach(row => {
        const h = parseInt(row.dimensionValues?.[0]?.value || '0', 10);
        if (h >= 0 && h < 24) {
          hourly[h].users = parseInt(row.metricValues?.[0]?.value || '0', 10);
          hourly[h].sessions = parseInt(row.metricValues?.[1]?.value || '0', 10);
          hourly[h].pageViews = parseInt(row.metricValues?.[2]?.value || '0', 10);
        }
      });
    }

    // Peak hour
    const peakHour = hourly.reduce((best, cur) => cur.users > best.users ? cur : best, hourly[0]);

    // Sources
    const sources = sourceResponse.rows?.map(row => ({
      name: row.dimensionValues?.[0]?.value,
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
    })) || [];

    // Geographic data
    const regions = geoResponse.rows?.map(row => ({
      region: row.dimensionValues?.[0]?.value || 'Unknown',
      country: row.dimensionValues?.[1]?.value || 'Unknown',
      users: parseInt(row.metricValues?.[0]?.value || '0', 10),
      sessions: parseInt(row.metricValues?.[1]?.value || '0', 10),
    })).filter(r => r.region !== '(not set)') || [];

    // Top pages
    const topPages = engagementResponse.rows?.map(row => ({
      path: row.dimensionValues?.[0]?.value || '/',
      views: parseInt(row.metricValues?.[0]?.value || '0', 10),
      users: parseInt(row.metricValues?.[1]?.value || '0', 10),
    })) || [];

    return NextResponse.json({
      liveUsers,
      totalVisitors,
      bounceRate,
      totalSessions24h,
      avgSessionDuration,
      pagesPerSession,
      totalPageViews24h,
      hourly,
      peakHour: { hour: peakHour.hour, users: peakHour.users },
      sources,
      regions,
      topPages,
    });
  } catch (err: any) {
    console.error("GA Data API Error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
