import { runAgent, loadTenantContext, hydratePrompt, extractJson } from './runner';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';

const SYSTEM_PROMPT = `You are the Sentiment Analyst for the {{candidate_name}} campaign in {{state}}.

CANDIDATE POSITIONS:
{{positions_summary}}

You will receive a set of news items and competitor activities from the last 7 days, already grouped by topic. For each topic, produce an aggregate sentiment signal.

For each topic group, respond with a JSON object in the array:
{
  "topic": "<topic name>",
  "sentiment_score": <-1.0 to 1.0 overall sentiment of the public discourse on this topic>,
  "volume": <integer, total item count>,
  "velocity": <integer, (this 7d volume) - (prior 7d volume), negative OK>,
  "candidate_alignment": "aligned|opposed|neutral|mixed",
  "opportunity_score": <0-100; how valuable is this topic for our candidate to own right now>,
  "recommended_action": "<short imperative, max 12 words>",
  "key_phrases": [<3-6 short strings from the content>],
  "sample_posts": [
    { "text": "<quoted snippet, max 120 chars>", "url": "<url>", "engagement": 0, "sentiment": "positive|negative|neutral" }
  ]
}

Return ONLY a valid JSON array. No prose.`;

const TOPICS = [
  'economy', 'jobs', 'taxes', 'housing', 'water_policy', 'energy',
  'education', 'healthcare', 'immigration', 'public_safety', 'infrastructure',
  'environment', 'gun_policy', 'election_integrity', 'government_spending',
  'veterans', 'agriculture', 'tech_innovation', 'drug_policy', 'constitutional_rights',
];

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export async function runSentimentAnalyzer(tenantId = DEFAULT_TENANT) {
  const db = createServiceClient();
  const context = await loadTenantContext(tenantId);
  if (!context.tenant) throw new Error(`Tenant ${tenantId} not found`);

  const sevenDaysAgo = daysAgoIso(7);
  const fourteenDaysAgo = daysAgoIso(14);

  const [news7, news14, acts7, acts14] = await Promise.all([
    db.from('news_items').select('headline, summary, topics, source_url, published_at, sentiment')
      .eq('tenant_id', tenantId).gte('published_at', sevenDaysAgo).limit(500),
    db.from('news_items').select('topics')
      .eq('tenant_id', tenantId).gte('published_at', fourteenDaysAgo).lt('published_at', sevenDaysAgo).limit(500),
    db.from('competitor_activities').select('summary, raw_content, topics, source_url, detected_at, sentiment, engagement_metrics')
      .eq('tenant_id', tenantId).gte('detected_at', sevenDaysAgo).limit(500),
    db.from('competitor_activities').select('topics')
      .eq('tenant_id', tenantId).gte('detected_at', fourteenDaysAgo).lt('detected_at', sevenDaysAgo).limit(500),
  ]);

  // Bucket items by topic
  const byTopic: Record<string, any[]> = {};
  const priorVolume: Record<string, number> = {};

  for (const t of TOPICS) { byTopic[t] = []; priorVolume[t] = 0; }

  for (const n of (news7.data || [])) {
    for (const topic of (n.topics || [])) {
      if (!byTopic[topic]) byTopic[topic] = [];
      byTopic[topic].push({
        kind: 'news',
        text: n.summary || n.headline,
        url: n.source_url,
        sentiment: n.sentiment,
      });
    }
  }
  for (const a of (acts7.data || [])) {
    for (const topic of (a.topics || [])) {
      if (!byTopic[topic]) byTopic[topic] = [];
      byTopic[topic].push({
        kind: 'competitor',
        text: a.summary || (a.raw_content || '').substring(0, 200),
        url: a.source_url,
        sentiment: a.sentiment,
        engagement: (a.engagement_metrics?.like_count || 0) + (a.engagement_metrics?.retweet_count || 0),
      });
    }
  }

  for (const n of (news14.data || [])) {
    for (const topic of (n.topics || [])) priorVolume[topic] = (priorVolume[topic] || 0) + 1;
  }
  for (const a of (acts14.data || [])) {
    for (const topic of (a.topics || [])) priorVolume[topic] = (priorVolume[topic] || 0) + 1;
  }

  // Keep only topics with non-trivial volume
  const activeTopics = Object.entries(byTopic)
    .filter(([, items]) => items.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12);

  if (activeTopics.length === 0) {
    console.log('[SentimentAnalyzer] No topics with enough volume');
    return { topics: 0 };
  }

  const positionsSummary = context.positions
    .map((p: any) => `${p.topic}: ${p.position_summary?.substring(0, 100)} [${p.strength}]`)
    .join('\n');

  const prompt = hydratePrompt(SYSTEM_PROMPT, {
    candidate_name: context.tenant.candidate_name,
    state: context.tenant.state,
    positions_summary: positionsSummary || 'No positions defined yet.',
  });

  const userMessage = `Analyze these topic buckets (last 7 days). Prior-7d volume shown for velocity computation.\n\n` +
    activeTopics.map(([topic, items]) => {
      const currentVolume = items.length;
      const prior = priorVolume[topic] || 0;
      const sample = items.slice(0, 15).map((it: any, i: number) =>
        `  ${i + 1}. [${it.kind}|${it.sentiment || 'n/a'}] ${String(it.text || '').substring(0, 220)} (${it.url || 'no-url'})`
      ).join('\n');
      return `=== TOPIC: ${topic} ===\nCurrent 7d volume: ${currentVolume}\nPrior 7d volume: ${prior}\nVelocity: ${currentVolume - prior}\nSample items:\n${sample}`;
    }).join('\n\n');

  const result = await runAgent(
    { name: 'sentiment_analyzer', tenantId, systemPrompt: prompt, maxTokens: 4096 },
    userMessage,
    'scheduled'
  );

  const parsedOut = extractJson(result.output);
  const signals: any[] = Array.isArray(parsedOut) ? parsedOut : [];

  if (!Array.isArray(signals) || signals.length === 0) {
    console.warn('[SentimentAnalyzer] Model returned no parseable signals');
    return { topics: 0 };
  }

  const periodEnd = new Date().toISOString();
  const periodStart = sevenDaysAgo;

  let upserts = 0;
  for (const s of signals) {
    if (!s?.topic) continue;
    await db.from('sentiment_signals').insert({
      tenant_id: tenantId,
      platform: 'aggregate',
      source_identifier: 'news+competitors',
      topic: s.topic,
      subtopic: s.subtopic || '',
      sentiment_score: typeof s.sentiment_score === 'number' ? s.sentiment_score : 0,
      volume: s.volume || 0,
      velocity: typeof s.velocity === 'number' ? s.velocity : 0,
      sample_posts: Array.isArray(s.sample_posts) ? s.sample_posts.slice(0, 5) : [],
      key_phrases: Array.isArray(s.key_phrases) ? s.key_phrases.slice(0, 8) : [],
      opportunity_score: Math.max(0, Math.min(100, s.opportunity_score || 0)),
      candidate_alignment: s.candidate_alignment || 'neutral',
      recommended_action: s.recommended_action || '',
      period_start: periodStart,
      period_end: periodEnd,
    });
    upserts++;
  }

  return { topics: upserts };
}
