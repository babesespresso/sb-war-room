import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Temporary probe endpoint: tries a matrix of GHL endpoints from the server
// (where Cloudflare doesn't bot-block us) and reports which return real data
// versus 401/404. Remove once the correct email-stats endpoint is identified.
export async function GET() {
  const KEY = process.env.GHL_API_KEY;
  const LOC = process.env.GHL_LOCATION_ID;
  if (!KEY) return NextResponse.json({ error: 'no key' }, { status: 500 });

  const candidates = [
    // v1 guesses
    'https://rest.gohighlevel.com/v1/campaigns/',
    'https://rest.gohighlevel.com/v1/emails/statistics',
    'https://rest.gohighlevel.com/v1/emails/campaigns',
    'https://rest.gohighlevel.com/v1/emails/stats',
    'https://rest.gohighlevel.com/v1/email-statistics',
    'https://rest.gohighlevel.com/v1/bulk-actions',
    'https://rest.gohighlevel.com/v1/email/campaigns',
    // v2 LeadConnector (likely 401 with v1 key, but we'll know)
    `https://services.leadconnectorhq.com/emails/builder?locationId=${LOC}&limit=1`,
    `https://services.leadconnectorhq.com/emails/schedule?locationId=${LOC}&limit=1`,
    `https://services.leadconnectorhq.com/marketing/emails/schedule?locationId=${LOC}&limit=1`,
  ];

  const out: Array<{ url: string; status: number; preview: string }> = [];
  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${KEY}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      const text = await r.text();
      out.push({ url, status: r.status, preview: text.slice(0, 200) });
    } catch (e: any) {
      out.push({ url, status: -1, preview: e.message });
    }
  }
  return NextResponse.json({ results: out });
}
