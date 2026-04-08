import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'bottoms-2026';

/**
 * GET /api/settings
 * Returns current tenant configuration + live connection status for all integrations
 */
export async function GET() {
  const db = createServiceClient();

  // Fetch tenant record
  const { data: tenant, error } = await db
    .from('tenants')
    .select('*')
    .eq('id', TENANT_ID)
    .single();

  if (error || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Check connection statuses
  const connections: Record<string, { connected: boolean; detail?: string }> = {};

  // Supabase — already connected if we got here
  connections.supabase = { connected: true, detail: process.env.NEXT_PUBLIC_SUPABASE_URL || '' };

  // Anthropic
  connections.anthropic = {
    connected: !!process.env.ANTHROPIC_API_KEY,
    detail: process.env.ANTHROPIC_API_KEY ? `sk-ant-...${process.env.ANTHROPIC_API_KEY.slice(-4)}` : 'Not configured',
  };

  // Slack
  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (slackToken) {
    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${slackToken}` },
      });
      const data = await res.json();
      connections.slack = {
        connected: data.ok === true,
        detail: data.ok ? `Workspace: ${data.team}` : `Error: ${data.error}`,
      };
    } catch {
      connections.slack = { connected: false, detail: 'Connection failed' };
    }
  } else {
    connections.slack = { connected: false, detail: 'Not configured' };
  }

  // GoHighLevel
  connections.ghl = {
    connected: !!(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID),
    detail: process.env.GHL_API_KEY ? 'Configured' : 'Not configured',
  };

  // Social platforms
  connections.twitter = {
    connected: !!(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN),
    detail: process.env.TWITTER_API_KEY ? 'Configured' : 'Not configured',
  };
  connections.meta = {
    connected: !!(process.env.META_ACCESS_TOKEN && process.env.META_PAGE_ID),
    detail: process.env.META_ACCESS_TOKEN ? 'Configured' : 'Not configured',
  };

  // Build setup checklist dynamically
  const { count: competitorCount } = await db
    .from('competitors')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  const { count: positionCount } = await db
    .from('candidate_positions')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  const { count: briefCount } = await db
    .from('daily_briefs')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  const { count: agentRunCount } = await db
    .from('agent_runs')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  const checklist = [
    { label: 'Supabase project created', done: connections.supabase.connected },
    { label: 'Migrations run', done: !!tenant },
    { label: 'Competitors seeded', done: (competitorCount || 0) > 0 },
    { label: 'Positions seeded', done: (positionCount || 0) > 0 },
    { label: 'Slack app installed', done: connections.slack.connected },
    { label: 'Slack channels created', done: !!(process.env.SLACK_CHANNEL_WAR_ROOM && process.env.SLACK_CHANNEL_CONTENT_QUEUE) },
    { label: 'Claude API key set', done: connections.anthropic.connected },
    { label: 'First daily brief generated', done: (briefCount || 0) > 0 },
  ];

  // Build env status (which env vars are set — never expose values)
  const envStatus: Record<string, boolean> = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    SLACK_BOT_TOKEN: !!process.env.SLACK_BOT_TOKEN,
    SLACK_SIGNING_SECRET: !!process.env.SLACK_SIGNING_SECRET,
    SLACK_CHANNEL_WAR_ROOM: !!process.env.SLACK_CHANNEL_WAR_ROOM,
    SLACK_CHANNEL_COMPETITOR_WATCH: !!process.env.SLACK_CHANNEL_COMPETITOR_WATCH,
    SLACK_CHANNEL_CONTENT_QUEUE: !!process.env.SLACK_CHANNEL_CONTENT_QUEUE,
    SLACK_CHANNEL_NEWS_PULSE: !!process.env.SLACK_CHANNEL_NEWS_PULSE,
    SLACK_CHANNEL_ANALYTICS: !!process.env.SLACK_CHANNEL_ANALYTICS,
    SLACK_CHANNEL_REQUESTS: !!process.env.SLACK_CHANNEL_REQUESTS,
    GHL_API_KEY: !!process.env.GHL_API_KEY,
    GHL_LOCATION_ID: !!process.env.GHL_LOCATION_ID,
    META_ACCESS_TOKEN: !!process.env.META_ACCESS_TOKEN,
    META_PAGE_ID: !!process.env.META_PAGE_ID,
    TWITTER_API_KEY: !!process.env.TWITTER_API_KEY,
    TWITTER_ACCESS_TOKEN: !!process.env.TWITTER_ACCESS_TOKEN,
    WARBIRD_SERVICE_KEY: !!process.env.WARBIRD_SERVICE_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    DEFAULT_TENANT_ID: !!process.env.DEFAULT_TENANT_ID,
  };

  // Masked values for display
  const maskedValues: Record<string, string> = {};
  for (const [key, isSet] of Object.entries(envStatus)) {
    if (!isSet) {
      maskedValues[key] = '';
      continue;
    }
    const val = process.env[key] || '';
    if (key.includes('URL') || key.includes('EMAIL') || key === 'DEFAULT_TENANT_ID') {
      maskedValues[key] = val;
    } else if (key.startsWith('SLACK_CHANNEL')) {
      maskedValues[key] = val;
    } else {
      // Mask sensitive values: show first 6 and last 4 chars
      maskedValues[key] = val.length > 14
        ? `${val.slice(0, 6)}${'•'.repeat(Math.min(val.length - 10, 20))}${val.slice(-4)}`
        : '••••••••';
    }
  }

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      candidate_name: tenant.candidate_name,
      campaign_type: tenant.campaign_type,
      state: tenant.state,
      timezone: tenant.timezone,
      brief_time: tenant.brief_time,
      content_approval_required: tenant.content_approval_required,
      slack_channels: tenant.slack_channels,
      api_keys: tenant.api_keys,
      brand_config: tenant.brand_config,
    },
    connections,
    checklist,
    envStatus,
    maskedValues,
    stats: {
      competitors: competitorCount || 0,
      positions: positionCount || 0,
      briefs: briefCount || 0,
      agentRuns: agentRunCount || 0,
    },
  });
}

/**
 * POST /api/settings
 * Update tenant configuration (slack_channels, api_keys, brand_config, etc.)
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const db = createServiceClient();

  const updateFields: Record<string, unknown> = {};

  if (body.slack_channels) updateFields.slack_channels = body.slack_channels;
  if (body.api_keys) updateFields.api_keys = body.api_keys;
  if (body.brand_config) updateFields.brand_config = body.brand_config;
  if (body.timezone) updateFields.timezone = body.timezone;
  if (body.brief_time) updateFields.brief_time = body.brief_time;
  if (body.content_approval_required !== undefined) updateFields.content_approval_required = body.content_approval_required;
  if (body.voice_guide) updateFields.voice_guide = body.voice_guide;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await db
    .from('tenants')
    .update(updateFields)
    .eq('id', TENANT_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
