import { NextResponse } from 'next/server';
import { fetchMMDBData } from '@/lib/data/mmdb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchMMDBData();
    if (data.status === 'error') {
      return NextResponse.json({ error: data.error }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('MMDB API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
