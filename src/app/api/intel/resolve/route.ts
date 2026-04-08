import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'bottoms-2026';

/**
 * PATCH /api/intel/resolve
 * Update the response status of a competitor activity (threat).
 * Body: { id: string, response_status: 'acknowledged' | 'resolved' | 'unresolved' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, response_status } = body;

    if (!id || !response_status) {
      return NextResponse.json({ error: 'Missing id or response_status' }, { status: 400 });
    }

    if (!['acknowledged', 'resolved', 'unresolved'].includes(response_status)) {
      return NextResponse.json({ error: 'Invalid response_status. Use: acknowledged, resolved, unresolved' }, { status: 400 });
    }

    const db = createServiceClient();
    const updateData: Record<string, any> = {
      response_status,
    };

    if (response_status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = 'dashboard';
    } else if (response_status === 'unresolved') {
      updateData.resolved_at = null;
      updateData.resolved_by = null;
    }

    const { data, error } = await db
      .from('competitor_activities')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', TENANT_ID)
      .select('id, response_status, resolved_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, activity: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/intel/resolve
 * Bulk resolve/acknowledge competitor threats.
 * Body: { ids: string[], response_status: 'acknowledged' | 'resolved' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, response_status } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing or empty ids array' }, { status: 400 });
    }

    if (!['acknowledged', 'resolved'].includes(response_status)) {
      return NextResponse.json({ error: 'Invalid response_status' }, { status: 400 });
    }

    const db = createServiceClient();
    const updateData: Record<string, any> = {
      response_status,
    };

    if (response_status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = 'dashboard';
    }

    const { data, error } = await db
      .from('competitor_activities')
      .update(updateData)
      .in('id', ids)
      .eq('tenant_id', TENANT_ID)
      .select('id, response_status');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: data?.length || 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
