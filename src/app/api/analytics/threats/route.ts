import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || 'bottoms-2026';

// Generate Bearer Token using OAuth 2.0 Client Credentials
async function getBearerToken(): Promise<string> {
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

// Simple AI threat classification based on content analysis
function classifyThreat(text: string, authorMetrics: any): {
  threat_level: 'hostile' | 'negative' | 'bot' | 'spam' | 'safe';
  confidence: number;
  flags: string[];
} {
  const flags: string[] = [];
  let hostileScore = 0;
  let botScore = 0;
  let negativeScore = 0;

  const lower = text.toLowerCase();

  // Hostile patterns
  const hostileWords = ['vote him out', 'rino', 'corrupt', 'liar', 'fraud', 'fake', 'scandal', 'exposed', 'criminal', 'resign', 'trash', 'garbage', 'worst', 'destroy', 'pathetic', 'disgrace', 'shame'];
  const hostileMatches = hostileWords.filter(w => lower.includes(w));
  if (hostileMatches.length > 0) {
    hostileScore += hostileMatches.length * 20;
    flags.push(`Hostile language: ${hostileMatches.join(', ')}`);
  }

  // ALL CAPS detection
  const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1);
  if (capsRatio > 0.5 && text.length > 20) {
    hostileScore += 15;
    flags.push('Excessive caps (aggressive tone)');
  }

  // Misinformation patterns
  if (lower.includes('breaking') && (lower.includes('proof') || lower.includes('exposed') || lower.includes('caught'))) {
    hostileScore += 25;
    flags.push('Misinformation pattern detected');
  }
  if (lower.includes('share before') || lower.includes('rt before') || lower.includes('before they delete')) {
    hostileScore += 20;
    flags.push('Urgency manipulation');
  }

  // Bot patterns
  const mentionCount = (text.match(/@\w+/g) || []).length;
  if (mentionCount > 5) {
    botScore += 20;
    flags.push(`Mass mentions (${mentionCount} accounts tagged)`);
  }

  // Repetitive text
  const words = lower.split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 5 && uniqueWords.size / words.length < 0.4) {
    botScore += 25;
    flags.push('Repetitive text pattern');
  }

  // Suspicious links
  if (lower.includes('bit.ly') || lower.includes('tinyurl') || lower.includes('t.co') && (lower.includes('proof') || lower.includes('exposed'))) {
    botScore += 15;
    flags.push('Suspicious link with clickbait');
  }

  // Negative sentiment (milder)
  const negativeWords = ['disappointed', 'concerned', 'worried', 'wrong', 'disagree', 'bad', 'poor', 'weak', 'fail'];
  const negMatches = negativeWords.filter(w => lower.includes(w));
  if (negMatches.length > 0) {
    negativeScore += negMatches.length * 15;
    flags.push('Negative sentiment');
  }

  // Coordinated hashtag patterns
  const hashtags = (text.match(/#\w+/g) || []);
  const attackHashtags = hashtags.filter(h => {
    const hl = h.toLowerCase();
    return hl.includes('out') || hl.includes('fake') || hl.includes('bottom') || hl.includes('recall') || hl.includes('stop');
  });
  if (attackHashtags.length > 0) {
    negativeScore += 15;
    flags.push(`Attack hashtag: ${attackHashtags.join(', ')}`);
  }

  // Determine classification
  const maxScore = Math.max(hostileScore, botScore, negativeScore);
  if (maxScore < 15) {
    return { threat_level: 'safe', confidence: 0, flags: [] };
  }

  if (botScore >= hostileScore && botScore >= negativeScore) {
    return { threat_level: 'bot', confidence: Math.min(97, 50 + botScore), flags };
  }
  if (hostileScore >= negativeScore) {
    return { threat_level: 'hostile', confidence: Math.min(95, 40 + hostileScore), flags };
  }
  return { threat_level: 'negative', confidence: Math.min(85, 35 + negativeScore), flags };
}

// ============================================================
// META / FACEBOOK COMMENT SCANNER
// ============================================================
async function scanFacebookComments(): Promise<any[]> {
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!token || !pageId) return [];

  try {
    // Get recent posts
    const postsRes = await fetch(
      `https://graph.facebook.com/v25.0/${pageId}/posts?fields=id,message,created_time&limit=5&access_token=${token}`,
      { next: { revalidate: 300 } }
    );
    if (!postsRes.ok) return [];
    const postsData = await postsRes.json();
    const posts = postsData.data || [];

    const allComments: any[] = [];

    for (const post of posts) {
      // Get comments on each post
      const commentsRes = await fetch(
        `https://graph.facebook.com/v25.0/${post.id}/comments?fields=id,message,from,created_time,like_count&limit=50&access_token=${token}`
      );
      if (!commentsRes.ok) continue;
      const commentsData = await commentsRes.json();

      for (const comment of (commentsData.data || [])) {
        const classification = classifyThreat(comment.message || '', {});
        if (classification.threat_level === 'safe') continue;

        allComments.push({
          id: `fb_${comment.id}`,
          postId: `fb_${comment.id}`,
          author: comment.from?.name || 'Facebook User',
          handle: comment.from?.id ? `fb:${comment.from.id}` : 'unknown',
          avatar: comment.from?.id
            ? `https://graph.facebook.com/v25.0/${comment.from.id}/picture?type=square&access_token=${token}`
            : '',
          content: comment.message,
          timestamp: comment.created_time,
          threat_level: classification.threat_level,
          confidence: classification.confidence,
          flags: classification.flags,
          hidden: false,
          platform: 'facebook',
          metrics: { like_count: comment.like_count || 0 },
          authorVerified: false,
          authorFollowers: 0,
        });
      }
    }

    return allComments;
  } catch (err) {
    console.error('[ThreatScan] Facebook scan error:', err);
    return [];
  }
}

// ============================================================
// META / INSTAGRAM COMMENT SCANNER
// ============================================================
async function scanInstagramComments(): Promise<any[]> {
  const token = process.env.META_ACCESS_TOKEN;
  const igId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!token || !igId) return [];

  try {
    const mediaRes = await fetch(
      `https://graph.facebook.com/v25.0/${igId}/media?fields=id,caption&limit=5&access_token=${token}`,
      { next: { revalidate: 300 } }
    );
    if (!mediaRes.ok) return [];
    const mediaData = await mediaRes.json();
    const mediaList = mediaData.data || [];

    const allComments: any[] = [];

    for (const media of mediaList) {
      const commentsRes = await fetch(
        `https://graph.facebook.com/v25.0/${media.id}/comments?fields=id,text,username,timestamp,like_count&limit=50&access_token=${token}`
      );
      if (!commentsRes.ok) continue;
      const commentsData = await commentsRes.json();

      for (const comment of (commentsData.data || [])) {
        const classification = classifyThreat(comment.text || '', {});
        if (classification.threat_level === 'safe') continue;

        allComments.push({
          id: `ig_${comment.id}`,
          postId: `ig_${comment.id}`,
          author: comment.username || 'Instagram User',
          handle: comment.username ? `@${comment.username}` : 'unknown',
          avatar: '',
          content: comment.text,
          timestamp: comment.timestamp,
          threat_level: classification.threat_level,
          confidence: classification.confidence,
          flags: classification.flags,
          hidden: false,
          platform: 'instagram',
          metrics: { like_count: comment.like_count || 0 },
          authorVerified: false,
          authorFollowers: 0,
        });
      }
    }
    return allComments;
  } catch (err) {
    console.error('[ThreatScan] Instagram scan error:', err);
    return [];
  }
}

export async function GET() {
  try {
    const apiKey = (process.env.TWITTER_API_KEY || '').trim();
    const apiSecret = (process.env.TWITTER_API_SECRET || '').trim();

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ threats: [], error: 'X API keys not configured' });
    }

    const bearer = await getBearerToken();

    // Search for recent mentions
    const searchUrl = new URL('https://api.x.com/2/tweets/search/recent');
    searchUrl.searchParams.set('query', '@ScottBottomsCO -from:ScottBottomsCO -is:retweet');
    searchUrl.searchParams.set('max_results', '100'); // Boosted to 100 to cast the widest net and backfill the permanent inbox
    searchUrl.searchParams.set('tweet.fields', 'author_id,created_at,public_metrics,text,in_reply_to_user_id');
    searchUrl.searchParams.set('expansions', 'author_id');
    searchUrl.searchParams.set('user.fields', 'name,username,profile_image_url,public_metrics,created_at,verified');

    const res = await fetch(searchUrl.toString(), {
      headers: { 'Authorization': `Bearer ${bearer}` },
      next: { revalidate: 120 }, // cache for 2 min
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`X API ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const tweets = data.data || [];
    const users = (data.includes?.users || []).reduce((map: any, u: any) => {
      map[u.id] = u;
      return map;
    }, {} as Record<string, any>);

    // Classify each tweet
    const threats = tweets.map((tweet: any) => {
      const author = users[tweet.author_id] || {};
      const classification = classifyThreat(tweet.text, author.public_metrics);

      return {
        id: tweet.id,
        postId: tweet.id,
        author: author.name || 'Unknown',
        handle: `@${author.username || 'unknown'}`,
        avatar: author.profile_image_url || '',
        content: tweet.text,
        timestamp: tweet.created_at,
        threat_level: classification.threat_level,
        confidence: classification.confidence,
        flags: classification.flags,
        hidden: false,
        platform: 'x',
        metrics: tweet.public_metrics,
        authorVerified: author.verified || false,
        authorFollowers: author.public_metrics?.followers_count || 0,
        authorCreatedAt: author.created_at,
      };
    }).filter((t: any) => t.threat_level !== 'safe');  // Only return actual threats

    // --- FACEBOOK COMMENT SCANNING ---
    let fbThreats: any[] = [];
    try {
      fbThreats = await scanFacebookComments();
    } catch (e) {
      console.error('[ThreatScan] FB scan failed:', e);
    }

    // --- INSTAGRAM COMMENT SCANNING ---
    let igThreats: any[] = [];
    try {
      igThreats = await scanInstagramComments();
    } catch (e) {
      console.error('[ThreatScan] IG scan failed:', e);
    }

    // Merge all threats
    const allPlatformThreats = [...threats, ...fbThreats, ...igThreats];

    const db = createServiceClient();
    
    // Attempt to upsert the newly classified threats into the persistent database
    for (const t of allPlatformThreats) {
      await db.from('social_threats').upsert({
        tenant_id: DEFAULT_TENANT,
        post_id: t.id,
        platform: t.platform || 'x',
        author_name: t.author,
        author_handle: t.handle,
        avatar_url: t.avatar,
        content: t.content,
        threat_level: t.threat_level,
        confidence: t.confidence,
        flags: t.flags,
        metrics: t.metrics,
      }, { onConflict: 'tenant_id, post_id', ignoreDuplicates: true }); // keep existing status if it exists
    }

    // Now securely fetch all threats from the database (persisted inbox)
    // We omit 'ignored' and 'reported' from this default array to keep the payload clean
    const { data: persistentThreats } = await db
      .from('social_threats')
      .select('*')
      .eq('tenant_id', DEFAULT_TENANT)
      .in('status', ['active', 'hidden'])
      .order('detected_at', { ascending: false })
      .limit(100);

    // Map database rows to the expected UI model
    const uiThreats = (persistentThreats || []).map((t: any) => ({
      id: t.post_id,
      postId: t.post_id,
      author: t.author_name || 'Unknown',
      handle: t.author_handle || 'unknown',
      avatar: t.avatar_url || '',
      content: t.content,
      timestamp: t.detected_at,
      threat_level: t.threat_level,
      confidence: t.confidence,
      flags: t.flags,
      hidden: t.status === 'hidden',
      platform: t.platform,
    }));

    return NextResponse.json({
      threats: uiThreats,
      total_scanned: tweets.length + fbThreats.length,
      threats_found: allPlatformThreats.length,
      safe_filtered: tweets.length - threats.length,
      fb_threats_found: fbThreats.length,
      last_scan: new Date().toISOString(),
      source: 'live',
    });
  } catch (error: any) {
    console.error('Threat scan error:', error.message);
    
    // Fallback: try to just return the database inbox if X API fails
    try {
      const db = createServiceClient();
      const { data: persistentThreats } = await db
        .from('social_threats')
        .select('*')
        .eq('tenant_id', DEFAULT_TENANT)
        .in('status', ['active', 'hidden'])
        .order('detected_at', { ascending: false })
        .limit(100);
        
      if (persistentThreats) {
        return NextResponse.json({
          threats: persistentThreats.map((t: any) => ({
            id: t.post_id, postId: t.post_id, author: t.author_name,
            handle: t.author_handle, avatar: t.avatar_url, content: t.content,
            timestamp: t.detected_at, threat_level: t.threat_level,
            confidence: t.confidence, flags: t.flags, hidden: t.status === 'hidden', platform: t.platform,
          })),
          source: 'database_fallback'
        });
      }
    } catch(dbErr) {
      // Ignored
    }

    return NextResponse.json({
      threats: [],
      error: error.message,
      source: 'error',
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, action } = await req.json();
    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
    }

    const db = createServiceClient();
    let newStatus = 'active';
    
    if (action === 'ignore') newStatus = 'ignored';
    else if (action === 'hide') {
      newStatus = 'hidden';
      // Autonomously hide the comment natively on Facebook / Instagram 
      if (id.startsWith('fb_') || id.startsWith('ig_')) {
        const metaId = id.replace('fb_', '').replace('ig_', '');
        const token = process.env.META_ACCESS_TOKEN;
        if (token) {
          try {
            await fetch(`https://graph.facebook.com/v25.0/${metaId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_hidden: true, access_token: token })
            });
          } catch (e) {
            console.error('Failed to hide natively on Meta', e);
          }
        }
      }
    }
    else if (action === 'unhide') {
      newStatus = 'active';
      // Autonomously unhide the comment natively on Facebook / Instagram 
      if (id.startsWith('fb_') || id.startsWith('ig_')) {
        const metaId = id.replace('fb_', '').replace('ig_', '');
        const token = process.env.META_ACCESS_TOKEN;
        if (token) {
          try {
            await fetch(`https://graph.facebook.com/v25.0/${metaId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_hidden: false, access_token: token })
            });
          } catch (e) {
            console.error('Failed to unhide natively on Meta', e);
          }
        }
      }
    }
    else if (action === 'report') newStatus = 'reported';
    else return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const { error } = await db
      .from('social_threats')
      .update({ status: newStatus })
      .eq('tenant_id', DEFAULT_TENANT)
      .eq('post_id', id);

    if (error) throw error;
    
    return NextResponse.json({ success: true, id, status: newStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
