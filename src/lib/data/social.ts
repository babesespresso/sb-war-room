/**
 * Shared Social data-fetching module.
 * Fetches real Twitter data and stores daily follower snapshots
 * in Supabase for accurate growth tracking.
 *
 * Used by both /api/analytics/social and /api/analytics/priorities.
 */

import { twitterGet } from '@/lib/scrapers/twitter';
import { createServiceClient } from '@/lib/supabase/client';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'bottoms-2026';

export interface SocialData {
  connected: boolean;
  platform?: string;
  handle?: string;
  name?: string;
  profileImage?: string;
  stats?: {
    followers: number;
    following: number;
    totalTweets: number;
    listed: number;
    favourites: number;
    estimatedReach: number;
    estimatedEngagements: number;
    avgEngagementRate: number;
    followerGrowth: number;
  };
  engagementData?: EngagementDay[];
  accountAge?: number;
  lastUpdated?: string;
  error?: string;
  debug?: Record<string, boolean>;
  dataSource?: 'live_snapshots' | 'estimated';
}

interface EngagementDay {
  date: string;
  impressions: number;
  engagements: number;
  tweets: number;
  followerChange: number;
}

/**
 * Save today's follower count as a snapshot in performance_metrics.
 * Uses the existing table schema — upserts by (tenant_id, metric_date, platform).
 */
async function saveFollowerSnapshot(followers: number, followersChange: number): Promise<void> {
  try {
    const db = createServiceClient();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    await db.from('performance_metrics').upsert(
      {
        tenant_id: TENANT_ID,
        metric_date: today,
        platform: 'twitter',
        followers,
        followers_change: followersChange,
      },
      { onConflict: 'tenant_id,metric_date,platform' }
    );
  } catch (err) {
    console.error('Failed to save follower snapshot:', err);
  }
}

/**
 * Compute real follower growth from stored daily snapshots.
 * Returns the total followers_change over the last 14 days,
 * or computes delta from the oldest stored snapshot vs today.
 */
async function getStoredFollowerGrowth(currentFollowers: number): Promise<{ growth: number; source: 'live_snapshots' | 'estimated' }> {
  try {
    const db = createServiceClient();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: snapshots } = await db
      .from('performance_metrics')
      .select('metric_date, followers, followers_change')
      .eq('tenant_id', TENANT_ID)
      .eq('platform', 'twitter')
      .gte('metric_date', fourteenDaysAgo)
      .order('metric_date', { ascending: true });

    if (snapshots && snapshots.length >= 2) {
      // We have real historical data — compute delta from oldest stored to current
      const oldestSnapshot = snapshots[0];
      const oldestFollowers = oldestSnapshot.followers;
      if (oldestFollowers && oldestFollowers > 0) {
        return {
          growth: currentFollowers - oldestFollowers,
          source: 'live_snapshots',
        };
      }
    }

    // Not enough snapshots yet — use a conservative estimate (0)
    // This ensures we don't show random data while snapshots accumulate
    return { growth: 0, source: 'estimated' };
  } catch (err) {
    console.error('Failed to read follower snapshots:', err);
    return { growth: 0, source: 'estimated' };
  }
}

/**
 * Build engagement history from stored performance_metrics snapshots.
 * Falls back to estimated data if not enough snapshots exist.
 */
async function getStoredEngagementData(currentFollowers: number): Promise<{ data: EngagementDay[]; isStored: boolean }> {
  try {
    const db = createServiceClient();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: snapshots } = await db
      .from('performance_metrics')
      .select('metric_date, followers, followers_change, impressions, engagements, posts_count')
      .eq('tenant_id', TENANT_ID)
      .eq('platform', 'twitter')
      .gte('metric_date', fourteenDaysAgo)
      .order('metric_date', { ascending: true });

    if (snapshots && snapshots.length >= 2) {
      return {
        data: snapshots.map((s) => ({
          date: s.metric_date,
          impressions: s.impressions || 0,
          engagements: s.engagements || 0,
          tweets: s.posts_count || 0,
          followerChange: s.followers_change || 0,
        })),
        isStored: true,
      };
    }
  } catch (err) {
    console.error('Failed to read engagement snapshots:', err);
  }

  // Fallback: generate placeholder data labeled as estimates (no random noise)
  const data: EngagementDay[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      impressions: 0,
      engagements: 0,
      tweets: 0,
      followerChange: 0,
    });
  }
  return { data, isStored: false };
}

/**
 * Fetch live social analytics from Twitter and store snapshots.
 * This is the single source of truth, used by both API routes and priorities.
 */
export async function fetchSocialData(): Promise<SocialData> {
  const apiKey = (process.env.TWITTER_API_KEY || '').trim();
  const accessToken = (process.env.TWITTER_ACCESS_TOKEN || '').trim();
  const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();
  const accessSecret = (process.env.TWITTER_ACCESS_SECRET || '').trim();

  if (!apiKey || !accessToken || !apiSecret || !accessSecret) {
    return {
      connected: false,
      error: 'Twitter API keys not configured',
      debug: { hasKey: !!apiKey, hasToken: !!accessToken, hasSecret: !!apiSecret, hasAccessSecret: !!accessSecret },
    };
  }

  // Fetch live profile from Twitter
  const profile = await twitterGet('https://api.twitter.com/1.1/account/verify_credentials.json', {});

  const followers = profile.followers_count || 0;
  const following = profile.friends_count || 0;
  const totalTweets = profile.statuses_count || 0;
  const listed = profile.listed_count || 0;
  const favourites = profile.favourites_count || 0;

  const estimatedReach = Math.round(followers * 3.2);
  const estimatedEngagements = favourites + listed;
  const avgEngagementRate = followers > 0 ? ((estimatedEngagements / totalTweets) / followers * 100) : 0;

  const createdAt = new Date(profile.created_at);
  const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // ── Real follower growth from stored snapshots ──
  const { growth: followerGrowth, source } = await getStoredFollowerGrowth(followers);

  // ── Save today's snapshot ──
  await saveFollowerSnapshot(followers, followerGrowth);

  // ── Build engagement timeline from stored data ──
  const { data: engagementData } = await getStoredEngagementData(followers);

  return {
    connected: true,
    platform: 'X (Twitter)',
    handle: '@' + profile.screen_name,
    name: profile.name,
    profileImage: profile.profile_image_url_https?.replace('_normal', '_400x400'),
    stats: {
      followers,
      following,
      totalTweets,
      listed,
      favourites,
      estimatedReach,
      estimatedEngagements,
      avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
      followerGrowth,
    },
    engagementData,
    accountAge: daysSinceCreation,
    lastUpdated: new Date().toISOString(),
    dataSource: source,
  };
}
