import { runAgent, loadTenantContext, hydratePrompt } from './runner';
import { insertContentDraft } from '@/lib/supabase/queries';
import { postToSlack } from '@/lib/slack/client';
import { DEFAULT_TENANT } from '@/lib/supabase/client';

const SYSTEM_PROMPT = `You are the Email Campaign Writer for the {{candidate_name}} campaign.

BRAND SYSTEM:
- Primary: Navy #1a3147
- Secondary: Red #dc2626
- Accent: White #ffffff
- Donation button: WinRed CTA (red background, white text, rounded)
- Signature: Handwritten signature image (use placeholder)
- Footer: Social media icons (X, FB, IG, website)
- Wife: Linda Bottoms (reference naturally when appropriate, never forced)
- No emojis. No em dashes. Direct, conversational voice.

VOICE GUIDE: {{voice_guide}}

{{video_training_section}}

Given a topic and context, generate a COMPLETE campaign email with:
1. Subject line (under 50 chars, creates urgency or curiosity)
2. Preview text (under 100 chars)
3. Full HTML email body using the brand system

STRUCTURE:
- Opening hook: 1-2 sentences, personal or news-driven
- Body: 3-4 paragraphs, builds the case
- Donation ask: natural, tied to the message
- WinRed button: centered, red background, white text
- Closing: personal touch
- Signature: "Scott" with handwritten signature image
- Footer: social links, unsubscribe, paid for by

Every email answers: "why does this matter to YOUR life in Colorado?"
Donation asks should feel like an investment in Colorado's future.

Respond with valid JSON:
{
  "subject": "",
  "preview_text": "",
  "body_html": "<full html email>",
  "donation_amounts": [25, 50, 100, 250],
  "strategic_rationale": ""
}

IMPORTANT: The HTML should be a complete, self-contained email template using inline styles.
Use table-based layout for email client compatibility.
Background: #f4f4f4 wrapper, #ffffff content area.
Navy header bar with campaign logo/name.
Red CTA buttons with white text.
Footer with small gray text.`;

/**
 * Build the video training injection section for email prompts.
 */
function buildVideoTrainingSection(videoTalkingPoints: any, topic?: string): string {
  if (!videoTalkingPoints || videoTalkingPoints.source_count === 0) return '';

  const sections: string[] = [];

  const relevantPoints = topic
    ? videoTalkingPoints.talking_points.filter((tp: any) => tp.topic === topic)
    : videoTalkingPoints.talking_points;

  const topPoints = relevantPoints.slice(0, 8);

  if (topPoints.length > 0) {
    sections.push(`=== AUTHENTIC VOICE FROM SCOTT'S OWN SPEECHES & INTERVIEWS ===
Use these REAL quotes from Scott to make the email feel authentically written by him:

${topPoints.map((tp: any) =>
  `- [${tp.topic}] "${tp.quote}"`
).join('\n')}`);
  }

  const vp = videoTalkingPoints.voice_patterns;
  if (vp?.common_phrases?.length > 0) {
    sections.push(`SCOTT'S SIGNATURE PHRASES: ${vp.common_phrases.slice(0, 10).map((p: string) => `"${p}"`).join(', ')}`);
  }

  return sections.join('\n\n');
}

export async function generateEmail(
  topic: string,
  context: string,
  tenantId = DEFAULT_TENANT
) {
  const tenantContext = await loadTenantContext(tenantId);
  if (!tenantContext.tenant) throw new Error(`Tenant ${tenantId} not found`);

  const videoTrainingSection = buildVideoTrainingSection(
    tenantContext.videoTalkingPoints,
    topic
  );

  const prompt = hydratePrompt(SYSTEM_PROMPT, {
    candidate_name: tenantContext.tenant.candidate_name,
    voice_guide: tenantContext.tenant.voice_guide,
    video_training_section: videoTrainingSection,
  });

  let positions = tenantContext.positions
    .filter((p: any) => topic.toLowerCase().includes(p.topic) || p.topic.includes(topic.toLowerCase().split(' ')[0]))
    .map((p: any) => `${p.topic}: ${p.position_summary}\nTalking points: ${p.talking_points?.join('; ')}`)
    .join('\n\n');

  // Enrich with video-extracted positions
  const videoPositions = (tenantContext.videoTalkingPoints?.policy_positions || [])
    .filter((pp: any) => topic.toLowerCase().includes(pp.topic) || pp.topic.includes(topic.toLowerCase().split(' ')[0]))
    .map((pp: any) => `${pp.topic} (from video): ${pp.position}\nScott's words: "${pp.supporting_quote}"`)
    .join('\n\n');

  if (videoPositions) {
    positions += (positions ? '\n\n' : '') + videoPositions;
  }

  const result = await runAgent(
    { name: 'email_content', tenantId, systemPrompt: prompt, maxTokens: 8192 },
    `Generate a campaign email about: ${topic}\n\nContext: ${context}\n\nRelevant positions:\n${positions || 'Use general campaign messaging.'}`,
    'triggered'
  );

  if (!result.parsed) throw new Error('Email agent did not return valid JSON');

  const draft = await insertContentDraft({
    tenant_id: tenantId,
    content_type: 'email',
    title: result.parsed.subject,
    body: result.parsed.subject + ' | ' + result.parsed.preview_text,
    html_body: result.parsed.body_html,
    platform: 'email',
    strategic_rationale: result.parsed.strategic_rationale,
    intelligence_source: context,
    status: 'pending_review',
  });

  await postToSlack(
    process.env.SLACK_CHANNEL_CONTENT_QUEUE!,
    `:email: *New Email Draft*\n\n` +
    `*Subject:* ${result.parsed.subject}\n` +
    `*Preview:* ${result.parsed.preview_text}\n` +
    `_Strategy: ${result.parsed.strategic_rationale}_\n\n` +
    `:thumbsup: Approve  :pencil2: Revise  :x: Reject`
  );

  return { draft, email: result.parsed };
}
