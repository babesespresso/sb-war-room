import { createServiceClient, DEFAULT_TENANT } from './client';
import type {
  Competitor, CompetitorActivity, NewsItem, SentimentSignal,
  ContentDraft, DailyBrief, PerformanceMetric, AgentRun,
  CandidatePosition, DashboardStats, ContentStatus, ThreatLevel
} from '@/types';

const db = () => createServiceClient();

// ---- Competitors ----

export async function getCompetitors(tenantId = DEFAULT_TENANT) {
  const { data, error } = await db()
    .from('competitors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('threat_level', { ascending: false });
  if (error) throw error;
  return data as Competitor[];
}

export async function getCompetitorActivities(
  tenantId = DEFAULT_TENANT,
  opts: { limit?: number; since?: string; competitorId?: string; threatLevel?: ThreatLevel } = {}
) {
  let query = db()
    .from('competitor_activities')
    .select('*, competitor:competitors(name, party)')
    .eq('tenant_id', tenantId)
    .order('detected_at', { ascending: false })
    .limit(opts.limit || 50);

  if (opts.since) query = query.gte('detected_at', opts.since);
  if (opts.competitorId) query = query.eq('competitor_id', opts.competitorId);
  if (opts.threatLevel) query = query.eq('threat_level', opts.threatLevel);

  const { data, error } = await query;
  if (error) throw error;
  return data as CompetitorActivity[];
}

// ---- News ----

export async function getNewsItems(
  tenantId = DEFAULT_TENANT,
  opts: { limit?: number; minRelevance?: number; topic?: string; responseOnly?: boolean } = {}
) {
  let query = db()
    .from('news_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('published_at', { ascending: false })
    .limit(opts.limit || 50);

  if (opts.minRelevance) query = query.gte('relevance_score', opts.minRelevance);
  if (opts.topic) query = query.contains('topics', [opts.topic]);
  if (opts.responseOnly) query = query.eq('response_opportunity', true);

  const { data, error } = await query;
  if (error) throw error;
  return data as NewsItem[];
}

// ---- Sentiment ----

export async function getSentimentSignals(
  tenantId = DEFAULT_TENANT,
  opts: { topic?: string; limit?: number } = {}
) {
  let query = db()
    .from('sentiment_signals')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('opportunity_score', { ascending: false })
    .limit(opts.limit || 20);

  if (opts.topic) query = query.eq('topic', opts.topic);

  const { data, error } = await query;
  if (error) throw error;
  return data as SentimentSignal[];
}

export async function getHeatMap(tenantId = DEFAULT_TENANT) {
  const { data, error } = await db()
    .from('sentiment_signals')
    .select('topic, sentiment_score, volume, velocity, candidate_alignment, opportunity_score')
    .eq('tenant_id', tenantId)
    .order('opportunity_score', { ascending: false });
  if (error) throw error;
  return data;
}

// ---- Content ----

export async function getContentDrafts(
  tenantId = DEFAULT_TENANT,
  opts: { status?: ContentStatus; type?: string; limit?: number } = {}
) {
  let query = db()
    .from('content_drafts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(opts.limit || 50);

  if (opts.status) query = query.eq('status', opts.status);
  if (opts.type) query = query.eq('content_type', opts.type);

  const { data, error } = await query;
  if (error) throw error;
  return data as ContentDraft[];
}

export async function updateDraftStatus(
  draftId: string,
  status: ContentStatus,
  extra: Partial<ContentDraft> = {}
) {
  const { data, error } = await db()
    .from('content_drafts')
    .update({ status, ...extra })
    .eq('id', draftId)
    .select()
    .single();
  if (error) throw error;
  return data as ContentDraft;
}
export async function updateDraftBody(
  draftId: string,
  body: string
) {
  const { data, error } = await db()
    .from('content_drafts')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', draftId)
    .select()
    .single();
  if (error) throw error;
  return data as ContentDraft;
}

export async function insertContentDraft(draft: Partial<ContentDraft>) {
  const { data, error } = await db()
    .from('content_drafts')
    .insert(draft)
    .select()
    .single();
  if (error) throw error;
  return data as ContentDraft;
}

// ---- Positions ----

export async function getPositions(tenantId = DEFAULT_TENANT, topic?: string) {
  let query = db()
    .from('candidate_positions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (topic) query = query.eq('topic', topic);

  const { data, error } = await query;
  if (error) throw error;
  return data as CandidatePosition[];
}

// ---- Daily Brief ----

export async function getLatestBrief(tenantId = DEFAULT_TENANT) {
  const { data, error } = await db()
    .from('daily_briefs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('brief_date', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data as DailyBrief | null;
}

export async function insertDailyBrief(brief: Partial<DailyBrief>) {
  const { data, error } = await db()
    .from('daily_briefs')
    .insert(brief)
    .select()
    .single();
  if (error) throw error;
  return data as DailyBrief;
}

// ---- Performance ----

export async function getPerformanceMetrics(
  tenantId = DEFAULT_TENANT,
  opts: { platform?: string; start?: string; end?: string } = {}
) {
  let query = db()
    .from('performance_metrics')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('metric_date', { ascending: false });

  if (opts.platform) query = query.eq('platform', opts.platform);
  if (opts.start) query = query.gte('metric_date', opts.start);
  if (opts.end) query = query.lte('metric_date', opts.end);

  const { data, error } = await query;
  if (error) throw error;
  return data as PerformanceMetric[];
}

// ---- Agent Runs ----

export async function getAgentRuns(tenantId = DEFAULT_TENANT, limit = 20) {
  const { data, error } = await db()
    .from('agent_runs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AgentRun[];
}

export async function logAgentRun(run: Partial<AgentRun>) {
  const { data, error } = await db()
    .from('agent_runs')
    .insert(run)
    .select()
    .single();
  if (error) throw error;
  return data as AgentRun;
}

export async function completeAgentRun(
  runId: string,
  result: Partial<AgentRun>
) {
  const { error } = await db()
    .from('agent_runs')
    .update({ ...result, completed_at: new Date().toISOString() })
    .eq('id', runId);
  if (error) throw error;
}

// ---- Dashboard Stats ----

export async function getDashboardStats(tenantId = DEFAULT_TENANT): Promise<DashboardStats> {
  const today = new Date().toISOString().split('T')[0];

  const [pending, published, alerts, metricsToday, metricsRecent, competitors, topOpp] = await Promise.all([
    db().from('content_drafts').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'pending_review'),
    db().from('content_drafts').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'published').gte('published_at', today),
    db().from('competitor_activities').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).in('threat_level', ['high', 'critical']).gte('detected_at', today),
    // Try today's metrics first
    db().from('performance_metrics').select('followers_change, platform')
      .eq('tenant_id', tenantId).eq('metric_date', today),
    // Fall back to most recent metrics if today is empty
    db().from('performance_metrics').select('followers_change, platform, metric_date')
      .eq('tenant_id', tenantId).order('metric_date', { ascending: false }).limit(5),
    db().from('competitors').select('name, threat_level')
      .eq('tenant_id', tenantId).eq('is_active', true).eq('threat_level', 'critical').limit(1),
    // Get top sentiment opportunity
    db().from('sentiment_signals').select('topic, opportunity_score')
      .eq('tenant_id', tenantId).order('opportunity_score', { ascending: false }).limit(1),
  ]);

  // Use today's metrics if available, otherwise fall back to most recent date
  const metricsData = (metricsToday.data && metricsToday.data.length > 0)
    ? metricsToday.data
    : (metricsRecent.data || []).filter((m: any) =>
        m.metric_date === metricsRecent.data?.[0]?.metric_date
      );

  const followerGrowth = metricsData.reduce((sum: number, m: any) => sum + (m.followers_change || 0), 0);

  return {
    pendingContent: pending.count || 0,
    publishedToday: published.count || 0,
    competitorAlerts: alerts.count || 0,
    followerGrowth,
    topThreat: competitors.data?.[0] ? { name: competitors.data[0].name, level: competitors.data[0].threat_level } : null,
    topOpportunity: topOpp.data?.[0] ? { topic: topOpp.data[0].topic, score: topOpp.data[0].opportunity_score } : null,
  };
}

// ---- Video Training Sources ----

export async function getVideoTrainingSources(tenantId = DEFAULT_TENANT) {
  const { data, error } = await db()
    .from('video_training_sources')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getVideoTrainingSource(id: string) {
  const { data, error } = await db()
    .from('video_training_sources')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function insertVideoTrainingSource(source: Record<string, any>) {
  const { data, error } = await db()
    .from('video_training_sources')
    .insert(source)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVideoTrainingSource(id: string) {
  const { error } = await db()
    .from('video_training_sources')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/**
 * Get all extracted talking points from completed, active video training sources.
 * This is the critical query used by content generators to inject
 * authentic candidate voice into AI prompts.
 *
 * @param topic - Optional topic filter to get only relevant talking points
 */
export async function getActiveVideoTalkingPoints(
  tenantId = DEFAULT_TENANT,
  topic?: string
) {
  const { data, error } = await db()
    .from('video_training_sources')
    .select('id, title, source_type, extracted_talking_points, extracted_voice_patterns, extracted_policy_positions, training_weight')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('processing_status', 'completed');

  if (error) throw error;
  if (!data || data.length === 0) return { talking_points: [], voice_patterns: [], policy_positions: [], source_count: 0 };

  // Aggregate talking points across all sources, weighted by training_weight
  let allTalkingPoints: Array<{ topic: string; point: string; quote: string; confidence: number; source: string }> = [];
  let allPolicyPositions: Array<{ topic: string; position: string; supporting_quote: string; source: string }> = [];
  const allVoicePatterns: { common_phrases: string[]; rhetorical_devices: string[] } = {
    common_phrases: [],
    rhetorical_devices: [],
  };

  for (const source of data) {
    const weight = source.training_weight || 1.0;

    // Talking points
    const tps = (source.extracted_talking_points || []) as any[];
    for (const tp of tps) {
      if (topic && tp.topic !== topic) continue;
      allTalkingPoints.push({
        ...tp,
        confidence: (tp.confidence || 0.5) * weight,
        source: source.title,
      });
    }

    // Policy positions
    const pps = (source.extracted_policy_positions || []) as any[];
    for (const pp of pps) {
      if (topic && pp.topic !== topic) continue;
      allPolicyPositions.push({ ...pp, source: source.title });
    }

    // Voice patterns
    const vp = source.extracted_voice_patterns as any;
    if (vp?.common_phrases) allVoicePatterns.common_phrases.push(...vp.common_phrases);
    if (vp?.rhetorical_devices) allVoicePatterns.rhetorical_devices.push(...vp.rhetorical_devices);
  }

  // Sort by confidence descending, deduplicate phrases
  allTalkingPoints.sort((a, b) => b.confidence - a.confidence);
  allVoicePatterns.common_phrases = [...new Set(allVoicePatterns.common_phrases)];
  allVoicePatterns.rhetorical_devices = [...new Set(allVoicePatterns.rhetorical_devices)];

  return {
    talking_points: allTalkingPoints,
    voice_patterns: allVoicePatterns,
    policy_positions: allPolicyPositions,
    source_count: data.length,
  };
}

