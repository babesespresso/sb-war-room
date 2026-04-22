import crypto from 'crypto';

export function percentEncode(s: string) {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export function oauthSign(method: string, url: string, params: Record<string, string>) {
  const apiKey = (process.env.TWITTER_API_KEY || '').trim();
  const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();
  const accessToken = (process.env.TWITTER_ACCESS_TOKEN || '').trim();
  const accessSecret = (process.env.TWITTER_ACCESS_SECRET || '').trim();

  const nonce = crypto.randomBytes(16).toString('hex');
  const ts = Math.floor(Date.now() / 1000).toString();
  const op: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts,
    oauth_token: accessToken,
    oauth_version: '1.0',
    ...params
  };
  const ps = Object.keys(op).sort().map(k => percentEncode(k) + '=' + percentEncode(op[k])).join('&');
  const bs = method + '&' + percentEncode(url) + '&' + percentEncode(ps);
  const sk = percentEncode(apiSecret) + '&' + percentEncode(accessSecret);
  const sig = crypto.createHmac('sha1', sk).update(bs).digest('base64');
  return 'OAuth oauth_consumer_key="' + percentEncode(apiKey) + '", oauth_nonce="' + percentEncode(nonce) + '", oauth_signature="' + percentEncode(sig) + '", oauth_signature_method="HMAC-SHA1", oauth_timestamp="' + ts + '", oauth_token="' + percentEncode(accessToken) + '", oauth_version="1.0"';
}

export async function twitterGet(urlStr: string, params: Record<string, string> = {}) {
  const queryString = Object.entries(params).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const fullUrl = queryString ? urlStr + '?' + queryString : urlStr;
  const auth = oauthSign('GET', urlStr, params);
  
  const res = await fetch(fullUrl, {
    headers: { Authorization: auth },
    next: { revalidate: 300 } // cache for 5 min
  });
  
  if (!res.ok) {
    throw new Error(`Twitter API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Generate Bearer Token using OAuth 2.0 Client Credentials
export async function getBearerToken(): Promise<string> {
  const apiKey = (process.env.TWITTER_API_KEY || '').trim();
  const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  const res = await fetch('https://api.x.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  
  if (!res.ok) throw new Error(`Bearer token request failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function getXAnalytics() {
  const apiKey = (process.env.TWITTER_API_KEY || '').trim();
  const accessToken = (process.env.TWITTER_ACCESS_TOKEN || '').trim();
  const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();
  const accessSecret = (process.env.TWITTER_ACCESS_SECRET || '').trim();

  if (!apiKey || !accessToken || !apiSecret || !accessSecret) {
    return {
      connected: false,
      error: 'Twitter API keys not configured',
      debug: { hasKey: !!apiKey, hasToken: !!accessToken, hasSecret: !!apiSecret, hasAccessSecret: !!accessSecret }
    };
  }

  const profile = await twitterGet('https://api.twitter.com/1.1/account/verify_credentials.json', {});

  const followers = profile.followers_count || 0;
  const following = profile.friends_count || 0;
  const totalTweets = profile.statuses_count || 0;
  const listed = profile.listed_count || 0;
  const favourites = profile.favourites_count || 0;

  const createdAt = new Date(profile.created_at);
  const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // Real 14-day engagement series from X API v2 user timeline with public_metrics.
  // Each tweet exposes likes, retweets, replies, quotes, impressions, bookmarks.
  let engagementData: Array<{ date: string; impressions: number; engagements: number; tweets: number; followerChange: number }> = [];
  let engagementSource: 'x_api_v2' | 'unavailable' = 'unavailable';
  let engagementError: string | null = null;

  try {
    const userId = profile.id_str;
    if (!userId) throw new Error('Missing profile id_str');

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 13);

    const params: Record<string, string> = {
      max_results: '100',
      'tweet.fields': 'created_at,public_metrics,non_public_metrics,organic_metrics',
      exclude: 'retweets,replies',
      start_time: start.toISOString(),
    };

    const tweetsResp = await twitterGet(
      `https://api.twitter.com/2/users/${userId}/tweets`,
      params
    );

    const buckets = new Map<string, { impressions: number; engagements: number; tweets: number }>();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      buckets.set(d.toISOString().split('T')[0], { impressions: 0, engagements: 0, tweets: 0 });
    }

    for (const t of (tweetsResp.data || []) as any[]) {
      const day = (t.created_at || '').split('T')[0];
      const bucket = buckets.get(day);
      if (!bucket) continue;
      const pm = t.public_metrics || {};
      const om = t.organic_metrics || {};
      const npm = t.non_public_metrics || {};
      const impressions = pm.impression_count ?? om.impression_count ?? npm.impression_count ?? 0;
      const engagements = (pm.like_count || 0) + (pm.retweet_count || 0) + (pm.reply_count || 0) + (pm.quote_count || 0) + (pm.bookmark_count || 0);
      bucket.impressions += impressions;
      bucket.engagements += engagements;
      bucket.tweets += 1;
    }

    engagementData = [...buckets.entries()].map(([date, v]) => ({
      date,
      impressions: v.impressions,
      engagements: v.engagements,
      tweets: v.tweets,
      followerChange: 0, // X API does not expose daily follower delta; tracked separately via performance_metrics
    }));
    engagementSource = 'x_api_v2';
  } catch (err: any) {
    engagementError = err?.message || String(err);
    console.warn('[getXAnalytics] v2 timeline fetch failed:', engagementError);
    engagementData = [];
  }

  const realImpressions = engagementData.reduce((s, d) => s + d.impressions, 0);
  const realEngagements = engagementData.reduce((s, d) => s + d.engagements, 0);
  const engagementRate = realImpressions > 0
    ? parseFloat(((realEngagements / realImpressions) * 100).toFixed(2))
    : 0;

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
      // 14-day observed totals from v2 timeline. Zeroed if the fetch failed.
      impressions_14d: realImpressions,
      engagements_14d: realEngagements,
      engagementRate_14d: engagementRate,
    },
    engagementData,
    engagementSource,
    engagementError,
    accountAge: daysSinceCreation,
    lastUpdated: new Date().toISOString(),
  };
}
