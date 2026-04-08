import { NextRequest, NextResponse } from 'next/server';
import { getContentDrafts, updateDraftStatus, updateDraftBody, getAgentRuns } from '@/lib/supabase/queries';
import { generateContent, generateRapidResponse } from '@/lib/agents/content-generator';
import { generateEmail } from '@/lib/agents/email-content';
import { publishContent } from '@/lib/integrations/social-publisher';
import { DEFAULT_TENANT } from '@/lib/supabase/client';

function getTenant(req: NextRequest) {
  return req.headers.get('x-tenant-id') || DEFAULT_TENANT;
}

// GET /api/content?status=pending_review&type=social_twitter
export async function GET(request: NextRequest) {
  const tenant = getTenant(request);
  const status = request.nextUrl.searchParams.get('status') as any;
  const type = request.nextUrl.searchParams.get('type') || undefined;
  const view = request.nextUrl.searchParams.get('view');

  try {
    if (view === 'agent_runs') {
      return NextResponse.json(await getAgentRuns(tenant));
    }
    return NextResponse.json(await getContentDrafts(tenant, { status, type }));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/content - generate new content or update status
export async function POST(request: NextRequest) {
  const tenant = getTenant(request);
  const body = await request.json();

  try {
    switch (body.action) {
      case 'generate': {
        const result = await generateContent(
          body.content_type || 'social_twitter',
          body.topic,
          body.context || body.topic,
          tenant
        );
        return NextResponse.json({ success: true, draft: result.draft });
      }

      case 'rapid_response': {
        const result = await generateRapidResponse(
          body.trigger,
          body.source_content || body.trigger,
          tenant
        );
        return NextResponse.json({ success: true, ...result });
      }

      case 'approve': {
        const draft = await updateDraftStatus(body.draft_id, 'approved', {
          approved_by: body.approved_by || 'dashboard',
        });
        // Auto-publish to target platform
        publishContent(body.draft_id).catch(err =>
          console.error('[API] Auto-publish failed:', err)
        );
        return NextResponse.json({ success: true, draft });
      }

      case 'edit': {
        const draft = await updateDraftBody(body.draft_id, body.body);
        return NextResponse.json({ success: true, draft });
      }

      case 'generate_email': {
        const result = await generateEmail(
          body.topic,
          body.context || body.topic,
          tenant
        );
        return NextResponse.json({ success: true, draft: result.draft });
      }

      case 'reject': {
        const draft = await updateDraftStatus(body.draft_id, 'rejected', {
          rejection_reason: body.reason,
        });
        return NextResponse.json({ success: true, draft });
      }

      case 'revise': {
        const draft = await updateDraftStatus(body.draft_id, 'revision_requested', {
          revision_notes: body.notes,
        });
        return NextResponse.json({ success: true, draft });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/content - purge stale drafts (non-published)
export async function DELETE(request: NextRequest) {
  const { createServiceClient } = await import('@/lib/supabase/client');
  const db = createServiceClient();
  const tenant = getTenant(request);

  try {
    // First, find the draft IDs we want to delete
    const { data: staleDrafts } = await db
      .from('content_drafts')
      .select('id')
      .eq('tenant_id', tenant)
      .in('status', ['pending_review', 'draft', 'rejected', 'failed', 'revision_requested']);

    const ids = (staleDrafts || []).map((d: any) => d.id);

    if (ids.length === 0) {
      return NextResponse.json({ success: true, message: 'No stale drafts to purge', deleted: 0 });
    }

    // Delete any publishing_log entries that reference these drafts
    await db.from('publishing_log').delete().in('draft_id', ids);

    // Now delete the drafts themselves
    const { error } = await db
      .from('content_drafts')
      .delete()
      .in('id', ids);

    if (error) throw error;
    return NextResponse.json({ success: true, message: `Purged ${ids.length} stale drafts`, deleted: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
