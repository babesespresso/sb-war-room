import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';
import { fetchMMDBData } from '@/lib/data/mmdb';
import { fetchSocialData } from '@/lib/data/social';

export const dynamic = 'force-dynamic';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'bottoms-2026';

interface ActionItem {
  id: string;
  icon: string;
  title: string;
  detail: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  link: string;
  linkLabel: string;
  metric?: string;
}

interface HealthBreakdown {
  label: string;
  score: number;
  maxScore: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

interface WinItem {
  text: string;
  metric: string;
  link?: string;
}

interface DataSourceStatus {
  name: string;
  available: boolean;
  error?: string;
}

export async function GET() {
  try {
    const db = createServiceClient();
    const dataSources: DataSourceStatus[] = [];

    // ── Fetch MMDB directly (no self-referencing HTTP) ──
    let mmdbGrowth = 0, mmdbTotal = 0, mmdbPipeline = 0, mmdbVelocityChange = '';
    try {
      const mmdb = await fetchMMDBData();
      if (mmdb.status === 'live') {
        mmdbGrowth = mmdb.growth.weeklyVelocity;
        mmdbTotal = mmdb.growth.totalSupporters;
        mmdbPipeline = mmdb.pipelines.totalOpportunities;
        mmdbVelocityChange = mmdb.growth.velocityChange;
        dataSources.push({ name: 'MMDB (GoHighLevel)', available: true });
      } else {
        dataSources.push({ name: 'MMDB (GoHighLevel)', available: false, error: mmdb.error });
      }
    } catch (err: any) {
      dataSources.push({ name: 'MMDB (GoHighLevel)', available: false, error: err.message });
    }

    // ── Fetch Social directly (no self-referencing HTTP) ──
    let followers = 0, followerGrowth = 0, engagementRate = 0;
    try {
      const social = await fetchSocialData();
      if (social.connected) {
        followers = social.stats?.followers || 0;
        followerGrowth = social.stats?.followerGrowth || 0;
        engagementRate = social.stats?.avgEngagementRate || 0;
        dataSources.push({ name: 'X (Twitter)', available: true });
      } else {
        dataSources.push({ name: 'X (Twitter)', available: false, error: social.error });
      }
    } catch (err: any) {
      dataSources.push({ name: 'X (Twitter)', available: false, error: err.message });
    }

    // ── Fetch all DB data in parallel ──
    const [
      pendingRes,
      approvedRes,
      publishedRes,
      competitorHighRes,
      competitorResolvedRes,
      competitorRecentRes,
      newsRecentRes,
      topNewsMentionsRes,
      agentRunsRes,
    ] = await Promise.all([
      // Content
      db.from('content_drafts').select('id, body, content_type, created_at', { count: 'exact' }).eq('tenant_id', TENANT_ID).eq('status', 'pending_review').order('created_at', { ascending: false }).limit(5),
      db.from('content_drafts').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'approved'),
      db.from('content_drafts').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'published'),
      // Competitor threats — only UNRESOLVED ones (response_status is null or 'unresolved')
      db.from('competitor_activities').select('id, summary, threat_level, detected_at, competitor:competitor_id(name)', { count: 'exact' }).eq('tenant_id', TENANT_ID).in('threat_level', ['high', 'critical']).or('response_status.is.null,response_status.eq.unresolved').order('detected_at', { ascending: false }).limit(3),
      // Resolved threats (for wins section)
      db.from('competitor_activities').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).in('threat_level', ['high', 'critical']).eq('response_status', 'resolved'),
      // Recent competitor activity (last 48h)
      db.from('competitor_activities').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gte('detected_at', new Date(Date.now() - 48 * 3600000).toISOString()),
      // Recent news
      db.from('news_items').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).gte('published_at', new Date(Date.now() - 24 * 3600000).toISOString()),
      // News mentioning candidate
      db.from('news_items').select('id, headline, source_url').eq('tenant_id', TENANT_ID).or('headline.ilike.%Scott Bottoms%,summary.ilike.%Scott Bottoms%').order('published_at', { ascending: false }).limit(3),
      // Agent runs
      db.from('agent_runs').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'completed').gte('started_at', new Date(Date.now() - 24 * 3600000).toISOString()),
    ]);

    const pendingContent = pendingRes.count || 0;
    const pendingDrafts = pendingRes.data || [];
    const approvedContent = approvedRes.count || 0;
    const publishedContent = publishedRes.count || 0;
    const unresolvedThreats = competitorHighRes.count || 0;
    const threatItems = competitorHighRes.data || [];
    const resolvedThreats = competitorResolvedRes.count || 0;
    const recentCompetitorActivity = competitorRecentRes.count || 0;
    const recentNews = newsRecentRes.count || 0;
    const candidateMentions = topNewsMentionsRes.data || [];
    const agentRunsToday = agentRunsRes.count || 0;

    dataSources.push({ name: 'Supabase', available: true });

    // ── Health Score Breakdown ──
    const breakdown: HealthBreakdown[] = [];

    // 1. MMDB Growth (0-25)
    let mmdbScore = 0;
    if (mmdbGrowth > 500) mmdbScore = 25;
    else if (mmdbGrowth > 100) mmdbScore = 20;
    else if (mmdbGrowth > 20) mmdbScore = 12;
    else if (mmdbGrowth > 0) mmdbScore = 5;
    breakdown.push({ label: 'Supporter Growth', score: mmdbScore, maxScore: 25, status: mmdbScore >= 20 ? 'excellent' : mmdbScore >= 12 ? 'good' : mmdbScore > 0 ? 'warning' : 'critical' });

    // 2. Social Momentum (0-20)
    let socialScore = 0;
    if (followerGrowth > 100) socialScore = 20;
    else if (followerGrowth > 50) socialScore = 15;
    else if (followerGrowth > 10) socialScore = 8;
    else if (followerGrowth > 0) socialScore = 3;
    breakdown.push({ label: 'Social Momentum', score: socialScore, maxScore: 20, status: socialScore >= 15 ? 'excellent' : socialScore >= 8 ? 'good' : socialScore > 0 ? 'warning' : 'critical' });

    // 3. Pipeline Conversion (0-20)
    let pipelineScore = 0;
    if (mmdbPipeline > 500) pipelineScore = 20;
    else if (mmdbPipeline > 200) pipelineScore = 15;
    else if (mmdbPipeline > 50) pipelineScore = 8;
    else if (mmdbPipeline > 0) pipelineScore = 3;
    breakdown.push({ label: 'Pipeline Health', score: pipelineScore, maxScore: 20, status: pipelineScore >= 15 ? 'excellent' : pipelineScore >= 8 ? 'good' : pipelineScore > 0 ? 'warning' : 'critical' });

    // 4. Content Pipeline (0-20)
    let contentScore = 20;
    if (pendingContent > 10) contentScore = 5;
    else if (pendingContent > 5) contentScore = 10;
    else if (pendingContent > 2) contentScore = 15;
    breakdown.push({ label: 'Content Pipeline', score: contentScore, maxScore: 20, status: contentScore >= 15 ? 'excellent' : contentScore >= 10 ? 'good' : contentScore > 5 ? 'warning' : 'critical' });

    // 5. Threat Response (0-15) — Now rewards resolving threats
    let threatScore = 15;
    const totalHighThreats = unresolvedThreats + resolvedThreats;
    if (totalHighThreats === 0) {
      threatScore = 15; // No threats = full score
    } else {
      // Score based on the ratio of resolved vs total threats
      const resolveRatio = resolvedThreats / totalHighThreats;
      if (resolveRatio >= 0.8) threatScore = 15;
      else if (resolveRatio >= 0.5) threatScore = 12;
      else if (resolveRatio >= 0.2) threatScore = 8;
      else if (unresolvedThreats <= 2) threatScore = 10;
      else if (unresolvedThreats <= 5) threatScore = 6;
      else threatScore = 3;
    }
    breakdown.push({ label: 'Threat Response', score: threatScore, maxScore: 15, status: threatScore >= 12 ? 'excellent' : threatScore >= 8 ? 'good' : threatScore > 3 ? 'warning' : 'critical' });

    const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);

    // ── Action Items (with deep links) ──
    const actions: ActionItem[] = [];

    if (pendingContent > 0) {
      const topDraft = pendingDrafts[0];
      actions.push({
        id: 'pending-content',
        icon: 'content',
        title: `${pendingContent} Draft${pendingContent > 1 ? 's' : ''} Awaiting Approval`,
        detail: topDraft ? `"${topDraft.body?.substring(0, 80)}..."` : 'Review and approve to maintain publishing velocity',
        urgency: pendingContent > 3 ? 'high' : 'medium',
        link: '/content?status=pending_review',
        linkLabel: 'Review Drafts',
        metric: `${pendingContent} pending`,
      });
    }

    if (unresolvedThreats > 0) {
      const topThreat = threatItems[0];
      const competitorName = (topThreat?.competitor as any)?.name || 'Unknown';
      actions.push({
        id: 'competitor-threats',
        icon: 'competitor',
        title: `${unresolvedThreats} Unresolved Threat${unresolvedThreats > 1 ? 's' : ''}`,
        detail: topThreat ? `${competitorName}: "${topThreat.summary?.substring(0, 80)}..."` : 'Review and respond to competitor activity',
        urgency: unresolvedThreats > 5 ? 'critical' : 'high',
        link: '/competitors',
        linkLabel: 'Respond to Threats',
        metric: `${unresolvedThreats} unresolved`,
      });
    }

    if (recentCompetitorActivity > 3) {
      actions.push({
        id: 'competitor-activity',
        icon: 'radar',
        title: `${recentCompetitorActivity} Competitor Moves (48h)`,
        detail: 'Heavy competitor activity detected — monitor for emerging narratives',
        urgency: recentCompetitorActivity > 8 ? 'high' : 'medium',
        link: '/competitors',
        linkLabel: 'Intel Feed',
        metric: `${recentCompetitorActivity} activities`,
      });
    }

    if (mmdbGrowth > 100) {
      actions.push({
        id: 'mmdb-momentum',
        icon: 'opportunity',
        title: `${mmdbGrowth.toLocaleString()} New Supporters This Week`,
        detail: mmdbVelocityChange ? `Growth velocity: ${mmdbVelocityChange} vs last week — capitalize with welcome outreach campaign` : 'Capitalize with email welcome sequence and event invites',
        urgency: 'medium',
        link: '/',
        linkLabel: 'View MMDB',
        metric: mmdbVelocityChange || `+${mmdbGrowth}`,
      });
    }

    if (followerGrowth < 10) {
      actions.push({
        id: 'social-growth',
        icon: 'growth',
        title: 'Social Growth is Slow',
        detail: followerGrowth === 0
          ? 'No follower growth data yet — snapshots are being collected'
          : `Only +${followerGrowth} followers — generate a new post to boost engagement`,
        urgency: 'medium',
        link: '/analytics',
        linkLabel: 'Post Now',
        metric: `+${followerGrowth}`,
      });
    }

    if (candidateMentions.length > 0) {
      actions.push({
        id: 'news-mentions',
        icon: 'news',
        title: `${candidateMentions.length} News Mention${candidateMentions.length > 1 ? 's' : ''} Detected`,
        detail: `"${candidateMentions[0].headline?.substring(0, 80)}"`,
        urgency: 'medium',
        link: candidateMentions[0].source_url || '/',
        linkLabel: 'Read Article',
        metric: `${candidateMentions.length} articles`,
      });
    }

    if (approvedContent > 0) {
      actions.push({
        id: 'approved-schedule',
        icon: 'schedule',
        title: `${approvedContent} Approved — Ready to Publish`,
        detail: 'Content approved and waiting to be published to social platforms',
        urgency: 'low',
        link: '/content?status=approved',
        linkLabel: 'Publish Now',
        metric: `${approvedContent} ready`,
      });
    }

    if (actions.length === 0) {
      actions.push({
        id: 'all-clear',
        icon: 'opportunity',
        title: 'All Systems Operational',
        detail: 'No urgent items. Focus on outreach, events, and donor cultivation.',
        urgency: 'low',
        link: '/',
        linkLabel: 'View Dashboard',
      });
    }

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    actions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    // ── Wins with metrics and links ──
    const wins: WinItem[] = [];
    if (mmdbTotal > 0) wins.push({ text: 'Total MMDB Supporters', metric: mmdbTotal.toLocaleString(), link: '/' });
    if (mmdbGrowth > 0) wins.push({ text: 'New Contacts This Week', metric: `+${mmdbGrowth.toLocaleString()}`, link: '/' });
    if (followerGrowth > 0) wins.push({ text: 'Social Followers Gained', metric: `+${followerGrowth.toLocaleString()}`, link: '/analytics' });
    if (followers > 0) wins.push({ text: 'X Followers (@ScottBottomsCO)', metric: followers.toLocaleString(), link: '/analytics' });
    if (mmdbPipeline > 0) wins.push({ text: 'Active Pipeline Opportunities', metric: mmdbPipeline.toLocaleString(), link: '/' });
    if (publishedContent && publishedContent > 0) wins.push({ text: 'Content Published', metric: publishedContent.toString(), link: '/content' });
    if (resolvedThreats > 0) wins.push({ text: 'Threats Responded To', metric: resolvedThreats.toString(), link: '/competitors' });
    if (agentRunsToday > 0) wins.push({ text: 'AI Agent Runs Today', metric: agentRunsToday.toString(), link: '/agents' });

    return NextResponse.json({
      healthScore: totalScore,
      healthTrend: totalScore >= 75 ? 'Excellent' : totalScore >= 55 ? 'Strong' : totalScore >= 40 ? 'Steady' : 'Needs Attention',
      healthBreakdown: breakdown,
      actions: actions.slice(0, 6),
      wins: wins.slice(0, 6),
      lastUpdated: new Date().toISOString(),
      dataSources,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
