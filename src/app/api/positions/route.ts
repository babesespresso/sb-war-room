import { NextRequest, NextResponse } from 'next/server';
import { getPositions } from '@/lib/supabase/queries';
import { DEFAULT_TENANT } from '@/lib/supabase/client';

function getTenant(req: NextRequest) {
  return req.headers.get('x-tenant-id') || DEFAULT_TENANT;
}

export async function GET(request: NextRequest) {
  const tenant = getTenant(request);
  const posTopic = request.nextUrl.searchParams.get('topic') || undefined;
  try {
    return NextResponse.json(await getPositions(tenant, posTopic));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const tenant = getTenant(request);
  const body = await request.json();

  try {
    const { createServiceClient } = await import('@/lib/supabase/client');
    const db = createServiceClient();

    const { data, error } = await db
      .from('candidate_positions')
      .insert({
        tenant_id: tenant,
        topic: body.topic,
        subtopic: body.subtopic || null,
        position_summary: body.position_summary,
        talking_points: body.talking_points || [],
        supporting_data: body.supporting_data || [],
        vs_competitors: body.vs_competitors || {},
        strength: body.strength || 'developing',
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
