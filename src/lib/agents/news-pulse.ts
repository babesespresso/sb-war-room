import { runAgent, loadTenantContext, hydratePrompt } from './runner';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';
import { scrapeAllNews } from '@/lib/scrapers/news';
import { postToSlack } from '@/lib/slack/client';
import type { NewsAnalysis } from '@/types';

const SYSTEM_PROMPT = `You are the News Pulse Analyst for the {{candidate_name}} campaign in {{state}}.

CURRENT RACE STATUS (as of {{current_date}}):
{{race_context}}

CANDIDATE POSITIONS:
{{positions_summary}}

ACTIVE COMPETITORS:
{{competitor_list}}

For each news item, analyze and respond ONLY with valid JSON:
{
  "summary": "",
  "topics": [],
  "relevance_score": 0,
  "sentiment": "positive|negative|neutral",
  "mentions_candidate": false,
  "mentions_competitor": "",
  "response_opportunity": false,
  "response_urgency": "none|low|medium|high|critical",
  "suggested_angle": "",
  "related_positions": []
}

SCORING RULES:
- Relevance 80-100: Directly mentions Scott Bottoms or a named competitor in the race
- Relevance 60-79: Colorado political news directly related to a key campaign issue (water, economy, housing, etc.)
- Relevance 40-59: Statewide policy news that could affect the race indirectly
- Relevance 0-39: General Colorado news not relevant to the gubernatorial campaign

CRITICAL: "mentions_candidate" should be true ONLY if the article explicitly names "Scott Bottoms".
"mentions_competitor" should contain the competitor name if the article explicitly mentions an active competitor.
Do not flag generic use of common words. Focus on political content relevant to the governor's race.`;

const RACE_CONTEXT = `The 2026 Colorado Governor's race Republican primary includes the following ACTIVE candidates:
- Scott Bottoms (our candidate)
- Victor Marx - faith leader, 2M followers, high threat
- Barbara Kirkmeyer - State Senator, politically experienced, high threat
- Josh Griffin - Army veteran, low threat
- Will McBride - attorney, low threat
- Stevan Gess - logistics professional, low threat

ENDORSERS (dropped out and endorsed Scott Bottoms):
- Joe Oltmann - Dropped out March 2026, endorsed Bottoms, running for CO GOP Chair
- Jason Mikesell - Teller County Sheriff, dropped out March 2026, endorsed Bottoms

DEMOCRATIC PRIMARY:
- Michael Bennet - U.S. Senator, frontrunner, critical threat in general election
- Phil Weiser - Attorney General, high threat

INDEPENDENT:
- Greg Lopez - former Republican, running as Independent, low threat`;

export async function runNewsPulse(tenantId = DEFAULT_TENANT) {
  const db = createServiceClient();
  const context = await loadTenantContext(tenantId);
  if (!context.tenant) throw new Error(`Tenant ${tenantId} not found`);

  // Scrape fresh news via NewsData.io + RSS
  const articles = await scrapeAllNews(tenantId);

  if (articles.length === 0) {
    console.log('[NewsPulse] No new articles fetched');
    return { processed: 0 };
  }

  const positionsSummary = context.positions
    .map((p: any) => `${p.topic}: ${p.position_summary?.substring(0, 100)}`)
    .join('\n');

  const competitorList = context.competitors
    .filter((c: any) => c.role !== 'endorser')
    .map((c: any) => `- ${c.name} (${c.party}) [${c.threat_level}]`)
    .join('\n');

  const today = new Date().toISOString().split('T')[0];

  const prompt = hydratePrompt(SYSTEM_PROMPT, {
    candidate_name: context.tenant.candidate_name,
    state: context.tenant.state,
    positions_summary: positionsSummary || 'No positions defined yet.',
    competitor_list: competitorList,
    race_context: RACE_CONTEXT,
    current_date: today,
  });

  let processed = 0;
  let opportunities: any[] = [];

  // Process in batches of 5
  for (let i = 0; i < Math.min(articles.length, 50); i += 5) {
    const batch = articles.slice(i, i + 5);
    const batchText = batch.map((a, idx) =>
      `--- ARTICLE ${idx + 1} ---\nHeadline: ${a.title}\nSource: ${a.sourceName}\nPublished: ${a.published}\nContent: ${a.content.substring(0, 500)}\nURL: ${a.link}`
    ).join('\n\n');

    try {
      const result = await runAgent(
        { name: 'news_pulse', tenantId, systemPrompt: prompt },
        `Analyze these ${batch.length} news articles for political relevance to the Colorado governor's race. Respond with a JSON array of analysis objects, one per article:\n\n${batchText}`,
        'scheduled'
      );

      // Try to parse the array response
      let analyses: NewsAnalysis[] = [];
      try {
        const match = result.output.match(/\[[\s\S]*\]/);
        if (match) {
          analyses = JSON.parse(match[0]);
        } else if (result.parsed) {
          analyses = [result.parsed as NewsAnalysis];
        }
      } catch { /* skip unparseable */ }

      for (let j = 0; j < analyses.length && j < batch.length; j++) {
        const article = batch[j];
        const analysis = analyses[j];
        if (!analysis) continue;

        // Skip very low relevance articles (noise)
        if ((analysis.relevance_score || 0) < 20) continue;

        await db.from('news_items').insert({
          tenant_id: tenantId,
          headline: article.title,
          summary: analysis.summary || article.title,
          source_name: article.sourceName,
          source_url: article.link,
          published_at: article.published,
          topics: analysis.topics || [],
          relevance_score: analysis.relevance_score || 0,
          sentiment: analysis.sentiment || 'neutral',
          mentions_candidate: analysis.mentions_candidate || false,
          response_opportunity: analysis.response_opportunity || false,
          response_urgency: analysis.response_urgency || 'none',
          suggested_angle: analysis.suggested_angle || '',
          is_processed: true,
        });

        if (analysis.response_opportunity && ['high', 'critical'].includes(analysis.response_urgency)) {
          opportunities.push({ article, analysis });
        }

        processed++;
      }
    } catch (err) {
      console.error('[NewsPulse] Batch processing failed:', err);
    }
  }

  // Alert on high-priority response opportunities
  for (const opp of opportunities) {
    await postToSlack(
      process.env.SLACK_CHANNEL_NEWS_PULSE!,
      `:newspaper: *RESPONSE OPPORTUNITY* [${opp.analysis.response_urgency.toUpperCase()}]\n\n` +
      `*${opp.article.title}*\n` +
      `_${opp.article.sourceName}_\n\n` +
      `${opp.analysis.summary}\n\n` +
      `*Suggested angle:* ${opp.analysis.suggested_angle}\n` +
      `<${opp.article.link}|Read Full Article>`
    );
  }

  return { processed, opportunities: opportunities.length };
}
