import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1';

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function detectChannel(name: string): string {
  const n = name.toLowerCase();
  const hasSms = n.includes('sms') || n.includes('text');
  const hasEmail = n.includes('email');
  const hasDM = n.includes(' dm ') || n.includes('-dm-') || n.includes(' dm-') || n.includes('-dm ');
  const hasSlack = n.includes('slack');
  const hasIG = n.includes('instagram') || n.includes('_ig');
  const hasFB = n.includes('facebook') || n.includes(' fb');
  const hasWebform = n.includes('webform') || n.includes('web form');
  const hasDrip = n.includes('drip');
  const hasInvite = n.includes('invite') || n.includes('delegate');
  const hasChat = n.includes('chat');
  const hasForum = n.includes('forum') || n.includes('townhall') || n.includes('town hall');
  const hasMeetGreet = n.includes('meet') || n.includes('greet');
  const hasVolunteer = n.includes('volunteer');

  const channels: string[] = [];

  if (hasSms) channels.push('sms');
  if (hasEmail) channels.push('email');
  if (hasDM || hasChat) channels.push('dm');
  if (hasSlack) channels.push('slack');
  if (hasIG && !hasDM) channels.push('ig');
  if (hasFB && !hasDM) channels.push('fb');

  if (channels.length > 1) return 'multi';
  if (channels.length === 1) return channels[0];

  // Infer from patterns — delegate/invite/drip/forum/event workflows are SMS
  if (hasInvite || hasDrip || hasForum || hasMeetGreet || hasVolunteer) return 'sms';
  if (hasWebform) return 'multi';

  return 'workflow'; // Generic fallback
}

export async function GET() {
  try {
    const apiKey = process.env.GHL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GHL_API_KEY not configured' }, { status: 500 });
    }

    const res = await fetch(`${GHL_BASE_URL}/workflows/`, {
      headers: getHeaders(), cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Workflows API error: ${res.status}`);
    const data = await res.json();
    const workflows = (data.workflows || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      status: w.status,
      updatedAt: w.updatedAt,
      channel: detectChannel(w.name),
    }));

    return NextResponse.json({ workflows, status: 'live' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

