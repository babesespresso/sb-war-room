import { runAgent, loadTenantContext, hydratePrompt } from './runner';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';
import { postToSlack } from '@/lib/slack/client';
import { scrapeAllCompetitors } from '@/lib/scrapers/competitors';
import type { CompetitorAnalysis } from '@/types';

const SYSTEM_PROMPT = `You are the Competitor Monitor for the {{candidate_name}} campaign. Your job is to analyze competitor activity and assess its strategic implications.

IMPORTANT RACE CONTEXT:
- Joe Oltmann has DROPPED OUT of the governor's race and ENDORSED {{candidate_name}}. He is now an ally/surrogate, not a competitor. Track his activity as supportive.
- Jason Mikesell has DROPPED OUT and ENDORSED {{candidate_name}}. He is now an ally, not a competitor.
- Any activity from endorsers should be classified as "endorsement" type with positive sentiment.

ACTIVE COMPETITORS YOU TRACK:
{{competitor_list}}

For each piece of competitor content or activity provided, you must:

1. SUMMARIZE the content in 2-3 sentences. Focus on the message, not the medium.
2. CLASSIFY by type: social_post, press_release, policy_announcement, endorsement, attack, ad_campaign, event, filing, media_appearance
3. IDENTIFY TOPICS from: economy, jobs, taxes, housing, water_policy, energy, education, healthcare, immigration, public_safety, infrastructure, environment, gun_policy, election_integrity, government_spending, veterans, agriculture, tech_innovation, drug_policy, constitutional_rights
4. ASSESS SENTIMENT: positive, negative, neutral, attack
5. RATE THREAT LEVEL: low, medium, high, critical
6. DETERMINE if REQUIRES RESPONSE (true/false)
7. If requires_response is true, provide SUGGESTED RESPONSE ANGLE.

Respond ONLY with valid JSON:
{
  "summary": "",
  "activity_type": "",
  "topics": [],
  "sentiment": "",
  "threat_level": "",
  "requires_response": false,
  "suggested_response": "",
  "engagement_assessment": ""
}

Be objective. Flag genuine threats honestly.`;

export async function runCompetitorMonitor(tenantId = DEFAULT_TENANT) {
  const db = createServiceClient();
  const context = await loadTenantContext(tenantId);

  if (!context.tenant) throw new Error(`Tenant ${tenantId} not found`);

  const competitorList = context.competitors
    .map((c: any) => `- ${c.name} (${c.party}) | Threat: ${c.threat_level} | Accounts: ${JSON.stringify(c.social_accounts)}`)
    .join('\n');

  const prompt = hydratePrompt(SYSTEM_PROMPT, {
    candidate_name: context.tenant.candidate_name,
    competitor_list: competitorList,
  });

  // Step 1: Scrape new competitor content from social platforms
  try {
    const scrapedPosts = await scrapeAllCompetitors(tenantId);
    console.log(`[CompetitorMonitor] Scraped ${scrapedPosts.length} new posts`);
  } catch (err) {
    console.warn('[CompetitorMonitor] Scraping failed (APIs may not be configured):', err);
  }

  // Step 2: Process any unanalyzed content with Claude
  const { data: rawItems } = await db
    .from('competitor_activities')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('summary', null)
    .limit(20);

  if (!rawItems || rawItems.length === 0) {
    console.log('[CompetitorMonitor] No new items to process');
    return { processed: 0 };
  }

  let processed = 0;
  let highAlerts: any[] = [];

  for (const item of rawItems) {
    try {
      const result = await runAgent(
        { name: 'competitor_monitor', tenantId, systemPrompt: prompt },
        `Analyze this competitor content:\n\nPlatform: ${item.platform}\nContent: ${item.raw_content}\nSource: ${item.source_url}`,
        'scheduled'
      );

      if (result.parsed) {
        const analysis = result.parsed as CompetitorAnalysis;

        await db
          .from('competitor_activities')
          .update({
            summary: analysis.summary,
            activity_type: analysis.activity_type,
            topics: analysis.topics,
            sentiment: analysis.sentiment,
            threat_level: analysis.threat_level,
            requires_response: analysis.requires_response,
            suggested_response: analysis.suggested_response,
          })
          .eq('id', item.id);

        if (analysis.threat_level === 'high' || analysis.threat_level === 'critical') {
          highAlerts.push({ ...item, analysis });
        }

        processed++;
      }
    } catch (err) {
      console.error(`[CompetitorMonitor] Failed to process item ${item.id}:`, err);
    }
  }

  // Send high-priority alerts to Slack
  for (const alert of highAlerts) {
    const emoji = alert.analysis.threat_level === 'critical' ? ':rotating_light:' : ':warning:';
    await postToSlack(
      process.env.SLACK_CHANNEL_COMPETITOR_WATCH!,
      `${emoji} *${alert.analysis.threat_level.toUpperCase()} THREAT* from competitor\n\n` +
      `*Summary:* ${alert.analysis.summary}\n` +
      `*Topics:* ${alert.analysis.topics.join(', ')}\n` +
      `*Requires Response:* ${alert.analysis.requires_response ? 'YES' : 'No'}\n` +
      (alert.analysis.suggested_response ? `*Suggested Angle:* ${alert.analysis.suggested_response}\n` : '') +
      (alert.source_url ? `<${alert.source_url}|View Source>` : '')
    );
  }

  return { processed, alerts: highAlerts.length };
}
