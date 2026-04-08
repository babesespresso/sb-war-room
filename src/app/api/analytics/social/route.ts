import { NextResponse } from 'next/server';
import { fetchSocialData } from '@/lib/data/social';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchSocialData();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Twitter API Error:', error.message);
    return NextResponse.json({
      connected: false,
      error: error.message,
    }, { status: 500 });
  }
}
