import { NextResponse } from 'next/server';
import { getXAnalytics } from '@/lib/scrapers/twitter';

export async function GET() {
  try {
    const data = await getXAnalytics();
    if (!data.connected) {
      return NextResponse.json(data);
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Twitter API Error:', error.message);
    return NextResponse.json({
      connected: false,
      error: error.message,
    }, { status: 500 });
  }
}
