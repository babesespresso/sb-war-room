/**
 * Performance Tracker
 *
 * Closes the publishing -> performance feedback loop.
 * For each post published in the last 14 days, re-fetches current metrics
 * from the source platform and rolls them up into daily rows on
 * `performance_metrics`. Daily brief + dashboard read those rows.
 */

import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';
import { getXAnalytics } from '@/lib/scrapers/twitter';
import { TwitterApi } from 'twitter-api-v2';

interface PostMetric {
  draft_id: string;
  platform: string;
  post_id: string;
  post_url: string;
  published_at: string;
  impressions: number;
  engagements: number;
  likes: number;
  shares: number;
  comments: number;
}

async function fetchTweetMetrics(postIds: string[]): Promise<Map<string, any>> {
  const out = new Map<string, any>();
  if (postIds.length === 0) return out;
  if (!process.env.TWITTER_API_KEY) return out;

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
  });

  // Batch size 100 per X API v2
  for (let i = 0; i < postIds.length; i += 100) {
    const batch = postIds.slice(i, i + 100);
    try {
      const resp = await client.v2.tweets(batch, {
        'tweet.fields': ['public_metrics', 'non_public_metrics', 'organic_metrics', 'created_at'],
      });
      for (const t of resp.data || []) {
        out.set(t.id, t);
      }
    } catch (err) {
      console.error('[PerformanceTracker] tweet fetch failed:', err);
    }
  }
  return out;
}

async function fetchFacebookMetrics(postId: string): Promise<any | null> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${postId}?fields=shares,reactions.summary(true),comments.summary(true),insights.metric(post_impressions,post_engaged_users)&access_token=${token}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function runPerformanceTracker(tenantId = DEFAULT_TENANT) {
  const db = createServiceClient();

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 14);

  const { data: posts } = await db
    .from('publishing_log')
    .select('draft_id, platform, post_id, post_url, created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .gte('created_at', cutoff.toISOString());

  if (!posts || posts.length === 0) {
    console.log('[PerformanceTracker] No recent published posts');
    return { posts: 0, days: 0 };
  }

  const tweetIds = posts.filter((p: any) => p.platform === 'twitter' && p.post_id).map((p: any) => p.post_id);
  const tweetMetrics = await fetchTweetMetrics(tweetIds);

  const metrics: PostMetric[] = [];

  for (const p of posts) {
    if (p.platform === 'twitter') {
      const t = tweetMetrics.get(p.post_id);
      if (!t) continue;
      const pm = t.public_metrics || {};
      const om = t.organic_metrics || {};
      const npm = t.non_public_metrics || {};
      const impressions = pm.impression_count ?? om.impression_count ?? npm.impression_count ?? 0;
      const engagements = (pm.like_count || 0) + (pm.retweet_count || 0) + (pm.reply_count || 0) + (pm.quote_count || 0) + (pm.bookmark_count || 0);
      metrics.push({
        draft_id: p.draft_id,
        platform: 'twitter',
        post_id: p.post_id,
        post_url: p.post_url,
        published_at: t.created_at || p.created_at,
        impressions,
        engagements,
        likes: pm.like_count || 0,
        shares: pm.retweet_count || 0,
        comments: pm.reply_count || 0,
      });
    } else if (p.platform === 'facebook' && p.post_id) {
      const fb = await fetchFacebookMetrics(p.post_id);
      if (!fb) continue;
      const impressions = fb.insights?.data?.find((d: any) => d.name === 'post_impressions')?.values?.[0]?.value || 0;
      const engaged = fb.insights?.data?.find((d: any) => d.name === 'post_engaged_users')?.values?.[0]?.value || 0;
      const reactions = fb.reactions?.summary?.total_count || 0;
      const comments = fb.comments?.summary?.total_count || 0;
      const shares = fb.shares?.count || 0;
      metrics.push({
        draft_id: p.draft_id,
        platform: 'facebook',
        post_id: p.post_id,
        post_url: p.post_url,
        published_at: p.created_at,
        impressions,
        engagements: engaged || reactions + comments + shares,
        likes: reactions,
        shares,
        comments,
      });
    }
  }

  if (metrics.length === 0) {
    return { posts: 0, days: 0 };
  }

  // Aggregate by (metric_date, platform)
  const byDayPlatform = new Map<string, {
    platform: string;
    metric_date: string;
    impressions: number;
    engagements: number;
    posts_count: number;
    likes: number;
    shares: number;
    comments: number;
    top_posts: Array<{ draft_id: string; post_url: string; engagements: number }>;
  }>();

  for (const m of metrics) {
    const day = (m.published_at || new Date().toISOString()).split('T')[0];
    const key = `${day}::${m.platform}`;
    const cur = byDayPlatform.get(key) || {
      platform: m.platform,
      metric_date: day,
      impressions: 0,
      engagements: 0,
      posts_count: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      top_posts: [],
    };
    cur.impressions += m.impressions;
    cur.engagements += m.engagements;
    cur.posts_count += 1;
    cur.likes += m.likes;
    cur.shares += m.shares;
    cur.comments += m.comments;
    cur.top_posts.push({ draft_id: m.draft_id, post_url: m.post_url, engagements: m.engagements });
    byDayPlatform.set(key, cur);
  }

  // Pull follower totals per platform (best-effort) so we can compute followers_change day-over-day
  let currentFollowers: Record<string, number> = {};
  try {
    const x = await getXAnalytics();
    if ((x as any).connected) currentFollowers.twitter = (x as any).stats?.followers || 0;
  } catch { /* ignore */ }

  let days = 0;
  for (const row of byDayPlatform.values()) {
    // Fetch most recent previous row to compute followers_change
    const { data: prev } = await db
      .from('performance_metrics')
      .select('followers, metric_date')
      .eq('tenant_id', tenantId)
      .eq('platform', row.platform)
      .lte('metric_date', row.metric_date)
      .order('metric_date', { ascending: false })
      .limit(1);

    const prevFollowers = prev?.[0]?.followers || 0;
    const followers = currentFollowers[row.platform] ?? prevFollowers;
    const followers_change = prev?.[0]?.metric_date === row.metric_date ? 0 : followers - prevFollowers;

    row.top_posts.sort((a, b) => b.engagements - a.engagements);

    // Upsert on (tenant_id, platform, metric_date)
    const { error } = await db.from('performance_metrics').upsert({
      tenant_id: tenantId,
      metric_date: row.metric_date,
      platform: row.platform,
      followers,
      followers_change,
      posts_count: row.posts_count,
      impressions: row.impressions,
      reach: row.impressions,
      engagements: row.engagements,
      engagement_rate: row.impressions > 0 ? (row.engagements / row.impressions) : 0,
      likes: row.likes,
      shares: row.shares,
      comments: row.comments,
      clicks: 0,
      sent: 0,
      delivered: 0,
      opens: 0,
      open_rate: 0,
      click_rate: 0,
      unsubscribes: 0,
      response_sentiment: 0,
      top_posts: row.top_posts.slice(0, 5),
    }, { onConflict: 'tenant_id,platform,metric_date' as any });

    if (error) {
      console.error('[PerformanceTracker] upsert failed:', error);
    } else {
      days++;
    }
  }

  return { posts: metrics.length, days };
}
