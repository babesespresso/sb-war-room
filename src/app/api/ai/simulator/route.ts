import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { SCOTT_BOTTOMS_PERSONA } from '@/lib/persona';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

export async function POST(req: Request) {
  try {
    const { opponent, history, message } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 503 }
      );
    }

    const systemPrompt = `You are a highly advanced political debate simulator for the 2026 Colorado Gubernatorial election. 
You are simulating the persona of: ${opponent}.

Here is everything you know about your opponent Scott Bottoms (use this to craft targeted attacks):
${SCOTT_BOTTOMS_PERSONA}

Rules of Engagement:
1. You are actively debating Scott Bottoms (the user).
2. You must be extremely aggressive, politically cunning, and adversarial. Do not be polite.
3. Your goal is to dismantle his arguments using opposition research, facts, and emotional rhetoric tailored to your specific political party and base.
4. Keep responses punchy and debate-styled (2-4 sentences max). Do not write essays. Give him a specific question or attack to defend against at the end of each response.
5. Use his ACTUAL positions and platform pillars to construct targeted attacks — don't use generic talking points.

If you are simulating Phil Weiser (Democrat), focus on abortion rights, gun safety, Trump connections, environmental protections, and attack his "Reclaim" platform as regressive.
If you are simulating Barbara Kirkmeyer (Republican), focus on conservative purity, electability, fiscal irresponsibility, and question whether a pastor can govern.
If you are simulating Michael Bennet (Democrat), focus on his Senate record vs. Bottoms' state-level experience and attack his energy policy.
If you are a Generic Hostile Journalist, interrupt and demand yes-or-no answers, press on controversial stances.`;

    // Map the history to Anthropic's expected format, ignoring the first system-like intro message
    const formattedMessages: any[] = history
      .filter((m: any, index: number) => index > 0) // drop the initial "I am ready." local msg
      .map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

    // Add the current message
    formattedMessages.push({ role: 'user', content: message });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } } as any,
      ],
      messages: formattedMessages,
      temperature: 0.7
    });

    const reply = (response.content[0] as any).text;

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Simulator API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
