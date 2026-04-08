import { NextResponse } from 'next/server';

const META_API_VERSION = 'v25.0';

/**
 * GET /api/analytics/meta
 * Pulls Facebook Page and Instagram insights from the Meta Graph API
 */
export async function GET() {
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!token || !pageId) {
    return NextResponse.json({
      connected: false,
      error: 'META_ACCESS_TOKEN or META_PAGE_ID not configured',
    });
  }

  try {
    // --- FACEBOOK PAGE DATA ---
    // 1. Page info + follower count
    const pageInfoRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${pageId}?fields=name,followers_count,fan_count,about,picture.type(large)&access_token=${token}`,
      { next: { revalidate: 300 } }
    );
    if (!pageInfoRes.ok) {
        const errorData = await pageInfoRes.json();
        throw new Error(errorData.error?.message || 'Failed to fetch Facebook Page Insights');
    }
    const pageInfo = await pageInfoRes.json();

    // 2. Recent posts with engagement
    const postsRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${pageId}/posts?fields=message,created_time,shares,reactions.summary(true),comments.summary(true),full_picture,permalink_url&limit=10&access_token=${token}`,
      { next: { revalidate: 300 } }
    );
    const postsData = postsRes.ok ? await postsRes.json() : { data: [] };

    // 3. Page insights (28 day period)
    const insightsRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${pageId}/insights?metric=page_impressions,page_engaged_users,page_post_engagements,page_views_total&period=day&date_preset=last_28d&access_token=${token}`,
      { next: { revalidate: 600 } }
    );
    const insightsData = insightsRes.ok ? await insightsRes.json() : { data: [] };

    // Process FB posts
    const fbPosts = (postsData.data || []).map((post: any) => ({
      id: post.id,
      message: post.message || '(Photo/Video post)',
      created_time: post.created_time,
      reactions: post.reactions?.summary?.total_count || 0,
      comments: post.comments?.summary?.total_count || 0,
      shares: post.shares?.count || 0,
      image: post.full_picture || null,
      url: post.permalink_url || `https://www.facebook.com/${post.id}`,
    }));

    // Process insights into summary
    const fbInsights: Record<string, number> = {};
    for (const metric of (insightsData.data || [])) {
      const values = metric.values || [];
      const total = values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
      fbInsights[metric.name] = total;
    }

    // --- INSTAGRAM DATA ---
    let igData: any = null;
    let igPosts: any[] = [];

    // Try to auto-discover IG account if not set
    let activeIgId = igAccountId;
    if (!activeIgId) {
      try {
        const igDiscoverRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${pageId}?fields=instagram_business_account&access_token=${token}`
        );
        if (igDiscoverRes.ok) {
          const igDiscoverData = await igDiscoverRes.json();
          activeIgId = igDiscoverData.instagram_business_account?.id || '';
        }
      } catch { /* IG not linked */ }
    }

    if (activeIgId) {
      // IG profile
      const igProfileRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${activeIgId}?fields=username,name,followers_count,follows_count,media_count,profile_picture_url,biography&access_token=${token}`,
        { next: { revalidate: 300 } }
      );
      if (igProfileRes.ok) {
        igData = await igProfileRes.json();
      }

      // IG recent media
      const igMediaRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${activeIgId}/media?fields=caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink&limit=10&access_token=${token}`,
        { next: { revalidate: 300 } }
      );
      if (igMediaRes.ok) {
        const igMediaData = await igMediaRes.json();
        igPosts = (igMediaData.data || []).map((post: any) => ({
          id: post.id,
          caption: post.caption || '',
          media_type: post.media_type,
          image: post.media_url || post.thumbnail_url || null,
          timestamp: post.timestamp,
          likes: post.like_count || 0,
          comments: post.comments_count || 0,
          url: post.permalink,
        }));
      }
    }

    // Calculate aggregate engagement
    const totalFbEngagement = fbPosts.reduce(
      (sum: number, p: any) => sum + p.reactions + p.comments + p.shares, 0
    );
    const avgFbEngagement = fbPosts.length > 0 ? Math.round(totalFbEngagement / fbPosts.length) : 0;

    return NextResponse.json({
      connected: true,
      facebook: {
        page_id: pageId,
        name: pageInfo?.name || 'Scott Bottoms',
        followers: pageInfo?.followers_count || pageInfo?.fan_count || 0,
        picture: pageInfo?.picture?.data?.url || null,
        posts: fbPosts,
        insights: fbInsights,
        total_engagement: totalFbEngagement,
        avg_engagement: avgFbEngagement,
      },
      instagram: activeIgId ? {
        account_id: activeIgId,
        username: igData?.username || '',
        name: igData?.name || '',
        followers: igData?.followers_count || 0,
        following: igData?.follows_count || 0,
        media_count: igData?.media_count || 0,
        picture: igData?.profile_picture_url || null,
        posts: igPosts,
      } : null,
      last_updated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Meta Analytics] Error:', error.message);
    return NextResponse.json({
      connected: false,
      error: error.message,
    }, { status: 500 });
  }
}
