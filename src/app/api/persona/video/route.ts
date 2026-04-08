import { NextRequest, NextResponse, after } from 'next/server';

// ... other imports ...
import { createServiceClient } from '@/lib/supabase/client';
import {
  getVideoTrainingSources,
  insertVideoTrainingSource,
  deleteVideoTrainingSource,
} from '@/lib/supabase/queries';
import { processVideoTrainingSource } from '@/lib/agents/video-analyzer';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'bottoms-2026';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/persona/video
 * List all video training sources for the tenant.
 */
export async function GET() {
  try {
    const sources = await getVideoTrainingSources(TENANT_ID);
    return NextResponse.json({ sources });
  } catch (error: any) {
    console.error('[VideoAPI] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/persona/video
 * Register a video that was already uploaded directly to Supabase Storage.
 * The client uploads the file directly to storage (bypassing the 4.5MB serverless limit),
 * then calls this endpoint with the storage path and metadata to create the DB record
 * and kick off the transcription/analysis pipeline.
 *
 * Accepts JSON body:
 * {
 *   storage_path: string,  // Supabase Storage path (e.g. "bottoms-2026/1712345678-video.mp4")
 *   title: string,
 *   source_type: string,
 *   file_size: number,
 *   description?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storage_path, title, source_type, file_size, description } = body;

    if (!storage_path) {
      return NextResponse.json({ error: 'Missing storage_path' }, { status: 400 });
    }

    const db = createServiceClient();

    // Generate a signed URL for the uploaded file (1 year expiry)
    const { data: urlData, error: urlErr } = await db.storage
      .from('video-training')
      .createSignedUrl(storage_path, 60 * 60 * 24 * 365);

    if (urlErr) {
      throw new Error(`Failed to create signed URL: ${urlErr.message}`);
    }

    const videoUrl = urlData?.signedUrl || '';

    // Create database record
    const record = await insertVideoTrainingSource({
      tenant_id: TENANT_ID,
      title: title || 'Untitled Video',
      description: description || '',
      video_url: videoUrl,
      source_type: source_type || 'other',
      processing_status: 'uploaded',
    });

    // Use Next.js 15 `after` API to ensure the lambda doesn't terminate before transcribing completes
    after(() => {
      processVideoTrainingSource(record.id, TENANT_ID).catch((err: any) => {
        console.error(`[VideoAPI] Processing failed for ${record.id}:`, err.message);
      });
    });

    return NextResponse.json({
      success: true,
      source: record,
      message: 'Video registered and processed successfully.',
    });
  } catch (error: any) {
    console.error('[VideoAPI] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/persona/video?id=<uuid>
 * Remove a video training source and its storage file.
 */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    // Get the record to find the storage path
    const db = createServiceClient();
    const { data: video } = await db
      .from('video_training_sources')
      .select('video_url')
      .eq('id', id)
      .single();

    // Delete from storage if possible
    if (video?.video_url) {
      try {
        // Extract the file path from the signed URL
        const url = new URL(video.video_url);
        const pathMatch = url.pathname.match(/video-training\/(.+?)(\?|$)/);
        if (pathMatch) {
          await db.storage.from('video-training').remove([decodeURIComponent(pathMatch[1])]);
        }
      } catch (storageErr) {
        console.warn('[VideoAPI] Storage cleanup failed (non-critical):', storageErr);
      }
    }

    // Delete the database record
    await deleteVideoTrainingSource(id);

    return NextResponse.json({ success: true, message: 'Video training source deleted' });
  } catch (error: any) {
    console.error('[VideoAPI] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
