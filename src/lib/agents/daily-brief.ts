import { runAgent, loadTenantContext, hydratePrompt } from './runner';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';
import { postToSlack } from '@/lib/slack/client';
import { format, subDays } from 'date-fns';

const SYSTEM_PROMPT = `You are the Campaign Strategist generating the daily brief for the {{candidate_name}} campaign for **Governor of Colorado** in the **2026 Colorado Gubernatorial election**.

CRITICAL: {{candidate_name}} is running for GOVERNOR of Colorado. NOT Senate, NOT President, NOT any other office. Every reference to the race, the office, or the candidate's goal must say "Governor" or "Gubernatorial". Do not write "U.S. Senate" or "Senate race" — those are wrong.

Today's date: {{current_date}}
State: Colorado
Office: Governor of Colorado
Election: 2026 Colorado Gubernatorial primary (June 2026) and general (November 2026)

RACE FIELD (2026 Colorado GOVERNOR race):
- Republican Primary (active): {{candidate_name}} (our candidate), Victor Marx, Barbara Kirkmeyer, Josh Griffin, Will McBride, Stevan Gess
- Republican endorsers (dropped out, backing Bottoms): Joe Oltmann, Jason Mikesell
- Democratic Primary: Michael Bennet (sitting U.S. Senator leaving the Senate to run for GOVERNOR — frontrunner, critical general-election threat), Phil Weiser (Attorney General, high threat)
- Independent: Greg Lopez (low threat)

Note on Bennet: he currently holds a U.S. Senate seat but is running for Colorado Governor in 2026. Always describe this race as the gubernatorial race, never the Senate race.

Generate a Daily Brief with these sections. **Every claim about a news story, competitor action, or external event MUST include a markdown source link in the form [Source Name](URL). If no URL is provided in the inputs, omit the claim rather than making one up.**

## Today's Strategic Picture
2-3 sentences. What is the state of the gubernatorial race TODAY? Reference real competitor activity and news with source links.

## Top Opportunities
3-5 content opportunities. For each:
- What triggered it (specific news, competitor action, or issue trend) — include [Source](URL)
- Recommended content type
- Platform(s)
- Priority (must-do, should-do, nice-to-have)
- Draft angle in 1 sentence

## Competitor Watch
Notable competitor activity in last 24h with recommended posture. Include [Source](URL) for every activity cited. Focus on ACTIVE competitors only. Oltmann and Mikesell are now allies.

## Issue Heat Map
Top 5 issues by public volume. Trend direction, our position strength, action needed.

## News to Watch
2-3 stories that may develop today. Each MUST be formatted as: "- [Headline](URL) — Source Name: why it matters"

## Yesterday's Scorecard
Top content, engagement summary, follower movement.

## Today's Avoid List
Topics to stay away from, with reason.

Keep total brief under 1500 words. Lead with action, not analysis. Do not fabricate URLs — only use URLs that appear in the INTELLIGENCE INPUTS block.`;

export async function runDailyBrief(tenantId = DEFAULT_TENANT) {
  const db = createServiceClient();
  const context = await loadTenantContext(tenantId);
  if (!context.tenant) throw new Error(`Tenant ${tenantId} not found`);

  const today = new Date().toISOString().split('T')[0];
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Gather intelligence from last 24 hours
  const [activities, news, sentiment, metrics] = await Promise.all([
    db.from('competitor_activities')
      .select('*, competitor:competitors(name)')
      .eq('tenant_id', tenantId)
      .gte('detected_at', `${yesterday}T00:00:00Z`)
      .order('threat_level', { ascending: false })
      .limit(30),
    db.from('news_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('relevance_score', 40)
      .gte('published_at', `${yesterday}T00:00:00Z`)
      .order('relevance_score', { ascending: false })
      .limit(20),
    db.from('sentiment_signals')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('opportunity_score', { ascending: false })
      .limit(10),
    db.from('performance_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('metric_date', yesterday),
  ]);

  const prompt = hydratePrompt(SYSTEM_PROMPT, {
    candidate_name: context.tenant.candidate_name,
    state: context.tenant.state,
    current_date: today,
  });

  const userMessage = `
INTELLIGENCE INPUTS FOR TODAY'S BRIEF:

=== COMPETITOR ACTIVITIES (Last 24h) ===
${(activities.data || []).map((a: any) =>
  `[${a.threat_level?.toUpperCase()}] ${a.competitor?.name}: ${a.summary || a.raw_content?.substring(0, 200)} (${a.activity_type})${a.source_url ? ` | URL: ${a.source_url}` : ''}`
).join('\n') || 'No notable competitor activity.'}

=== NEWS (Relevance >= 40) ===
${(news.data || []).map((n: any) =>
  `[Relevance: ${n.relevance_score}] ${n.headline} | Source: ${n.source_name} | URL: ${n.source_url || 'no-url'} | ${n.summary || ''} ${n.response_opportunity ? '** RESPONSE OPPORTUNITY **' : ''}`
).join('\n') || 'No significant news.'}

=== SENTIMENT SIGNALS ===
${(sentiment.data || []).map((s: any) => 
  `${s.topic}: Score ${s.sentiment_score}, Volume ${s.volume}, Velocity ${s.velocity > 0 ? '+' : ''}${s.velocity}, Alignment: ${s.candidate_alignment}, Opportunity: ${s.opportunity_score}`
).join('\n') || 'No sentiment data available yet.'}

=== YESTERDAY'S METRICS ===
${(metrics.data || []).map((m: any) => 
  `${m.platform}: ${m.impressions || 0} impressions, ${m.engagements || 0} engagements, ${m.followers_change > 0 ? '+' : ''}${m.followers_change || 0} followers`
).join('\n') || 'No metrics data from yesterday.'}

=== CANDIDATE POSITIONS ===
${context.positions.map((p: any) => `${p.topic}: ${p.position_summary?.substring(0, 100)} [Strength: ${p.strength}]`).join('\n')}
`;

  const result = await runAgent(
    { name: 'daily_brief', tenantId, systemPrompt: prompt, maxTokens: 4096 },
    userMessage,
    'scheduled'
  );

  // Store the brief
  const brief = await db.from('daily_briefs').insert({
    tenant_id: tenantId,
    brief_date: today,
    brief_markdown: result.output,
    opportunities: [],
    competitor_summary: {},
    trending_issues: [],
    news_highlights: [],
  }).select().single();

  // Post to Slack War Room
  await postToSlack(
    process.env.SLACK_CHANNEL_WAR_ROOM!,
    `:sunrise: *DAILY BRIEF -- ${format(new Date(), 'EEEE, MMMM d, yyyy')}*\n\n${result.output}`
  );

  return { briefId: brief.data?.id, output: result.output };
}
