import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'bottoms-2026';

export const dynamic = 'force-dynamic';

/**
 * GET /api/persona
 * Returns the current voice_guide, content_rules, and candidate identity for the tenant.
 */
export async function GET() {
  const db = createServiceClient();

  const { data: tenant, error } = await db
    .from('tenants')
    .select('id, candidate_name, campaign_type, state, voice_guide, content_rules, brand_config')
    .eq('id', TENANT_ID)
    .single();

  if (error || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  return NextResponse.json({
    candidate_name: tenant.candidate_name,
    campaign_type: tenant.campaign_type,
    state: tenant.state,
    voice_guide: tenant.voice_guide || '',
    content_rules: tenant.content_rules || [],
    brand_config: tenant.brand_config || {},
  });
}

/**
 * PUT /api/persona
 * Update voice_guide and content_rules for the tenant.
 */
export async function PUT(req: NextRequest) {
  const db = createServiceClient();
  const body = await req.json();

  const updates: Record<string, any> = {};

  if (typeof body.voice_guide === 'string') {
    updates.voice_guide = body.voice_guide;
  }

  if (Array.isArray(body.content_rules)) {
    updates.content_rules = body.content_rules;
  }

  if (typeof body.brand_config === 'object' && body.brand_config !== null) {
    updates.brand_config = body.brand_config;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from('tenants')
    .update(updates)
    .eq('id', TENANT_ID)
    .select('id, voice_guide, content_rules')
    .single();

  if (error) {
    console.error('Persona update error:', error);
    return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
