import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { SCOTT_BOTTOMS_PERSONA } from '@/lib/persona';
import { getActiveVideoTalkingPoints } from '@/lib/supabase/queries';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

export async function POST(req: Request) {
  try {
    const { activity } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        tweet: `${activity.competitor?.name || 'My opponent'} just proved they have no real plan for Colorado. I'm not going to waste time on their desperate attacks. I'll be in the communities they've abandoned, doing the work. #copolitics`,
        email: `Friend,\n\nDid you see what ${activity.competitor?.name || 'they'} just said about me? They are terrified of our momentum. I need your help right now. Chip in $5 so we can fight back and take Colorado in a new direction.`,
        quote: `I focus on policies that help hardworking Coloradans. My opponents focus on desperate political theater. Colorado deserves better.`
      });
    }

    // Load video training talking points for enhanced counter-strike
    let videoSection = '';
    try {
      const videoData = await getActiveVideoTalkingPoints();
      if (videoData.source_count > 0) {
        const topQuotes = videoData.talking_points
          .slice(0, 8)
          .map((tp: any) => `- "${tp.quote}" [${tp.topic}]`)
          .join('\n');

        const phrases = ((videoData.voice_patterns as any)?.common_phrases || []).slice(0, 10);

        videoSection = `
=== MY ACTUAL WORDS FROM SPEECHES & INTERVIEWS ===
Draw from these REAL quotes to craft an authentic response:
${topQuotes}

${phrases.length > 0 ? `MY SIGNATURE PHRASES: ${phrases.map((p: string) => `"${p}"`).join(', ')}` : ''}
`;
      }
    } catch {
      // Video training data not available, continue without it
    }

    // Detect topics from the activity to pull relevant talking points
    const activityText = `${activity.summary || ''} ${activity.raw_content || ''}`.toLowerCase();

    const systemPrompt = `You ARE Scott Bottoms. You are a conservative candidate for Colorado Governor and someone just attacked you.
The hostile move: "${activity.summary} - ${activity.raw_content}".

Write ALL content in FIRST PERSON as yourself. Use "I", "my", "we", "our". You ARE Scott Bottoms, not a staffer.
FORMATTING BAN: NEVER use em dashes. The character "—" is banned. Use periods, commas, or colons instead.

${SCOTT_BOTTOMS_PERSONA}
${videoSection}

Draft three pieces of retaliatory content in YOUR voice:
1. An aggressive tweet (1-2 tweets, max 280 chars each) dismantling their point. Sound authentic and direct. USE MY REAL PHRASES AND RHETORICAL PATTERNS from the voice samples above.
2. A fundraising email segment capitalizing on the attack. Write like you're personally writing to a supporter.
3. A punchy quote for the press that sounds like you said it to a reporter.

NEVER refer to yourself in 3rd person. NEVER say "Scott Bottoms believes." Say "I believe."

Format your response exactly as JSON:
{
  "tweet": "...",
  "email": "...",
  "quote": "..."
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Draft the counter-strike now. Return ONLY standard JSON.' }],
      temperature: 0.7
    });

    const reply = (response.content[0] as any).text;
    
    // Parse the JSON from the AI
    let parsed;
    try {
      const jsonStr = reply.substring(reply.indexOf('{'), reply.lastIndexOf('}') + 1);
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      // Fallback if parsing fails
      parsed = {
        tweet: "We will not be intimidated by these baseless attacks.",
        email: "They are attacking us. Chip in $10 to fight back.",
        quote: "Desperate politicians make desperate attacks."
      };
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('Counter-Strike API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
