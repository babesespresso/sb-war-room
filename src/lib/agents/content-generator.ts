import { runAgent, loadTenantContext, hydratePrompt } from './runner';
import { insertContentDraft } from '@/lib/supabase/queries';
import { postToSlack } from '@/lib/slack/client';
import { DEFAULT_TENANT } from '@/lib/supabase/client';
import { SCOTT_BOTTOMS_PERSONA } from '@/lib/persona';
import type { ContentType } from '@/types';

const SOCIAL_PROMPT = `You ARE {{candidate_name}}. You are writing a post for YOUR personal social media account.

CRITICAL: Write in FIRST PERSON. Use "I", "my", "we", "our". You are NOT a staffer writing about the candidate. You ARE the candidate. The post must sound like YOU personally typed it and hit send.

${SCOTT_BOTTOMS_PERSONA}

ADDITIONAL VOICE NOTES FROM CAMPAIGN: {{voice_guide}}
CONTENT RULES: {{content_rules}}
CUSTOM HASHTAGS: {{custom_hashtags}}
PLATFORM: {{platform}}

{{video_training_section}}

Platform guidelines:
- TWITTER: Max 280 chars, hook first, max 2 hashtags, no emojis. Sound direct, confident, authentic.
- FACEBOOK: 1-3 paragraphs, personal narrative, include CTA, ask your followers a question.
- INSTAGRAM: 1-2 paragraphs + hashtags (5-10), include visual direction. Speak to your community.
- TIKTOK: Script format: Hook (3s) / Problem (10s) / Solution (15s) / CTA (5s). Conversational.

Every post ties back to Colorado impact. Use concrete numbers, not vague promises. Sound like a leader who means business. Not a politician reading a teleprompter. Contrast on POLICY only, never personal attacks.

EXAMPLES OF CORRECT TONE:
- "I just got back from Grand Junction. The water crisis isn't theoretical. I saw it."
- "Here's what I'll do on Day 1 as your Governor..."
- "We're building something real here. Join us."
- "My opponent wants to talk about politics. I want to talk about your family's future."

NEVER write: "Scott Bottoms believes..." or "The candidate supports..." That is WRONG.
ALWAYS write: "I believe..." or "I support..." That is CORRECT.

FORMATTING BAN: NEVER use em dashes. The character "—" is banned. Use periods, commas, or colons instead. This is non-negotiable.

Respond ONLY with valid JSON:
{
  "platform": "",
  "post_copy": "",
  "hashtags": [],
  "visual_direction": "",
  "suggested_post_time": "",
  "strategic_rationale": "",
  "call_to_action": ""
}`;

const RAPID_RESPONSE_PROMPT = `You ARE {{candidate_name}}, and you need to respond to an attack or breaking development.

Write all responses in FIRST PERSON. Use "I", "my", "we". You are the candidate, not a staffer.
FORMATTING BAN: NEVER use em dashes. The character "—" is banned. Use periods, commas, or colons instead.

${SCOTT_BOTTOMS_PERSONA}

MY POSITIONS: {{positions}}

{{video_training_section}}

Generate exactly 3 response variants that I can choose from:

VARIANT A -- "MEASURED": Professional, pivot to my strength. Sounds like I'm above the fray.
VARIANT B -- "FIRM CONTRAST": Direct policy contrast with data. I directly challenge the opponent.
VARIANT C -- "REDIRECT": Acknowledge briefly, redirect to my strongest issue. Don't give it oxygen.

Respond ONLY with valid JSON:
{
  "trigger_summary": "",
  "variants": [
    { "label": "measured", "copy": "", "best_platforms": [], "risk_assessment": "", "recommended_timing": "" },
    { "label": "firm_contrast", "copy": "", "best_platforms": [], "risk_assessment": "", "recommended_timing": "" },
    { "label": "redirect", "copy": "", "best_platforms": [], "risk_assessment": "", "recommended_timing": "" }
  ],
  "do_not_list": [],
  "surrogate_recommendations": []
}

Remember: I never go personal. Policy contrast only. Consider whether NO response is best.`;

/**
 * Build the video training injection section for prompts.
 * This transforms extracted talking points and voice patterns
 * into a prompt fragment that grounds the AI in Scott's real words.
 */
function buildVideoTrainingSection(videoTalkingPoints: any, topic?: string): string {
  if (!videoTalkingPoints || videoTalkingPoints.source_count === 0) {
    return '';
  }

  const sections: string[] = [];

  // Talking points with exact quotes
  const relevantPoints = topic
    ? videoTalkingPoints.talking_points.filter((tp: any) => tp.topic === topic)
    : videoTalkingPoints.talking_points;

  // Limit to top 10 most confident points to keep prompt size manageable
  const topPoints = relevantPoints.slice(0, 10);

  if (topPoints.length > 0) {
    sections.push(`=== AUTHENTIC VOICE SAMPLES FROM SCOTT'S OWN WORDS ===
These are REAL quotes extracted from Scott's speeches, interviews, and videos.
PRIORITIZE these exact phrases and rhetorical patterns when generating content.
Rephrase and adapt for the platform, but keep the core message and tone intact.

${topPoints.map((tp: any, i: number) =>
  `${i + 1}. [${tp.topic.toUpperCase()}] "${tp.quote}"
   Key message: ${tp.point}${tp.source ? ` (Source: ${tp.source})` : ''}`
).join('\n\n')}`);
  }

  // Voice patterns
  const vp = videoTalkingPoints.voice_patterns;
  if (vp?.common_phrases?.length > 0 || vp?.rhetorical_devices?.length > 0) {
    const vpParts: string[] = [];
    if (vp.common_phrases?.length > 0) {
      vpParts.push(`SCOTT'S SIGNATURE PHRASES (use these): ${vp.common_phrases.slice(0, 15).map((p: string) => `"${p}"`).join(', ')}`);
    }
    if (vp.rhetorical_devices?.length > 0) {
      vpParts.push(`RHETORICAL PATTERNS: ${vp.rhetorical_devices.slice(0, 8).join('; ')}`);
    }
    sections.push(vpParts.join('\n'));
  }

  // Policy positions from videos (supplement the database positions)
  const relevantPositions = topic
    ? videoTalkingPoints.policy_positions.filter((pp: any) => pp.topic === topic)
    : videoTalkingPoints.policy_positions;

  if (relevantPositions.length > 0) {
    sections.push(`=== POLICY POSITIONS FROM SCOTT'S OWN STATEMENTS ===
${relevantPositions.slice(0, 5).map((pp: any) =>
  `- ${pp.topic}: ${pp.position}\n  Scott said: "${pp.supporting_quote}"`
).join('\n')}`);
  }

  return sections.length > 0
    ? sections.join('\n\n')
    : '';
}

export async function generateContent(
  contentType: ContentType,
  topic: string,
  context: string,
  tenantId = DEFAULT_TENANT
) {
  const tenantContext = await loadTenantContext(tenantId);
  if (!tenantContext.tenant) throw new Error(`Tenant ${tenantId} not found`);

  const platform = contentType.replace('social_', '');
  const brandConfig = tenantContext.tenant.brand_config || {};
  const customHashtags = brandConfig.custom_hashtags || [];

  // Build video training section for the topic
  const videoTrainingSection = buildVideoTrainingSection(
    tenantContext.videoTalkingPoints,
    topic
  );

  const prompt = hydratePrompt(SOCIAL_PROMPT, {
    candidate_name: tenantContext.tenant.candidate_name,
    voice_guide: tenantContext.tenant.voice_guide,
    content_rules: JSON.stringify(tenantContext.tenant.content_rules),
    custom_hashtags: customHashtags.length > 0 ? customHashtags.join(', ') : 'None specified',
    platform,
    video_training_section: videoTrainingSection,
  });

  // Build positions context, enriched with video-extracted positions
  let positionsContext = tenantContext.positions
    .filter((p: any) => p.topic === topic || topic.includes(p.topic))
    .map((p: any) => `${p.topic}: ${p.position_summary}\nTalking points: ${p.talking_points?.join('; ')}`)
    .join('\n') || '';

  // Add video-extracted policy positions that aren't already in the DB
  const videoPositions = (tenantContext.videoTalkingPoints?.policy_positions || [])
    .filter((pp: any) => pp.topic === topic || topic.includes(pp.topic))
    .map((pp: any) => `${pp.topic} (from video: ${pp.source || 'speech'}): ${pp.position}\nScott's words: "${pp.supporting_quote}"`)
    .join('\n');

  if (videoPositions) {
    positionsContext += (positionsContext ? '\n\n' : '') + videoPositions;
  }

  const result = await runAgent(
    { name: 'content_generator', tenantId, systemPrompt: prompt },
    `Generate a ${platform} post about: ${topic}\n\nContext: ${context}\n\nRelevant positions:\n${
      positionsContext || 'No specific position on file. Use general campaign messaging.'
    }`,
    'triggered'
  );

  if (!result.parsed) throw new Error('Content agent did not return valid JSON');

  // Sanitize suggested_post_time — AI often returns human-readable strings
  // like "7:30 AM - Peak engagement" which can't go into a timestamp column
  let postTime: string | undefined = undefined;
  const rawTime = result.parsed.suggested_post_time || '';
  try {
    const parsed = new Date(rawTime);
    if (!isNaN(parsed.getTime())) postTime = parsed.toISOString();
  } catch (_e) { /* not a valid date, leave null */ }

  // Save draft
  const draft = await insertContentDraft({
    tenant_id: tenantId,
    content_type: contentType,
    body: result.parsed.post_copy,
    hashtags: result.parsed.hashtags || [],
    visual_direction: result.parsed.visual_direction,
    suggested_post_time: postTime,
    platform,
    strategic_rationale: [
      result.parsed.strategic_rationale,
      rawTime && !postTime ? `Suggested timing: ${rawTime}` : '',
      result.parsed.call_to_action ? `CTA: ${result.parsed.call_to_action}` : '',
      tenantContext.videoTalkingPoints?.source_count
        ? `Trained from ${tenantContext.videoTalkingPoints.source_count} video source(s)`
        : '',
    ].filter(Boolean).join(' | '),
    intelligence_source: context,
    status: 'pending_review',
  });

  // Post to content queue for approval
  const slackMsg = await postToSlack(
    process.env.SLACK_CHANNEL_CONTENT_QUEUE!,
    `:memo: *New ${platform.toUpperCase()} Draft*\n\n` +
    `${result.parsed.post_copy}\n\n` +
    (result.parsed.hashtags?.length ? `_Hashtags: ${result.parsed.hashtags.join(' ')}_\n` : '') +
    (result.parsed.visual_direction ? `_Visual: ${result.parsed.visual_direction}_\n` : '') +
    `_Strategy: ${result.parsed.strategic_rationale}_\n\n` +
    `:thumbsup: Approve  :pencil2: Revise  :x: Reject`
  );

  return { draft, slackTs: slackMsg?.ts };
}

export async function generateRapidResponse(
  triggerDescription: string,
  sourceContent: string,
  tenantId = DEFAULT_TENANT
) {
  const tenantContext = await loadTenantContext(tenantId);
  if (!tenantContext.tenant) throw new Error(`Tenant ${tenantId} not found`);

  const positions = tenantContext.positions
    .map((p: any) => `${p.topic}: ${p.position_summary}\nTalking points: ${p.talking_points?.join('; ')}`)
    .join('\n\n');

  // Build video training section for rapid response (no topic filter — we want all available ammo)
  const videoTrainingSection = buildVideoTrainingSection(tenantContext.videoTalkingPoints);

  const prompt = hydratePrompt(RAPID_RESPONSE_PROMPT, {
    candidate_name: tenantContext.tenant.candidate_name,
    positions,
    video_training_section: videoTrainingSection,
  });

  const result = await runAgent(
    { name: 'rapid_response', tenantId, systemPrompt: prompt, maxTokens: 4096 },
    `TRIGGER: ${triggerDescription}\n\nSOURCE CONTENT:\n${sourceContent}`,
    'triggered'
  );

  if (!result.parsed) throw new Error('Rapid response agent did not return valid JSON');

  // Save all variants as drafts
  const drafts = [];
  for (const variant of result.parsed.variants) {
    const draft = await insertContentDraft({
      tenant_id: tenantId,
      content_type: 'rapid_response',
      title: `Rapid Response: ${variant.label}`,
      body: variant.copy,
      platform: variant.best_platforms?.[0] || 'twitter',
      strategic_rationale: variant.risk_assessment,
      status: 'pending_review',
      variant_label: variant.label,
    });
    drafts.push(draft);
  }

  // Post to War Room with urgency
  await postToSlack(
    process.env.SLACK_CHANNEL_WAR_ROOM!,
    `:rotating_light: *RAPID RESPONSE NEEDED*\n\n` +
    `*Trigger:* ${result.parsed.trigger_summary}\n\n` +
    result.parsed.variants.map((v: any) =>
      `*Option ${v.label.toUpperCase()}:*\n${v.copy}\n_Risk: ${v.risk_assessment}_\n_Timing: ${v.recommended_timing}_`
    ).join('\n\n---\n\n') +
    `\n\n:no_entry: *DO NOT:*\n${result.parsed.do_not_list.map((d: string) => `- ${d}`).join('\n')}` +
    `\n\n:thumbsup: React to the variant you want to publish.`
  );

  return { variants: result.parsed.variants, drafts, doNotList: result.parsed.do_not_list };
}
