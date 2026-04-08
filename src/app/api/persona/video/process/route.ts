import { NextRequest, NextResponse } from 'next/server';
import { processVideoTrainingSource } from '@/lib/agents/video-analyzer';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'bottoms-2026';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for transcription + analysis

/**
 * POST /api/persona/video/process
 * Triggers transcription and analysis for a video that was already uploaded.
 * Runs synchronously so the client can track progress via polling.
 * 
 * Body: { videoId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    console.log(`[VideoProcess] Starting processing for video: ${videoId}`);
    
    const result = await processVideoTrainingSource(videoId, TENANT_ID);

    return NextResponse.json({
      success: true,
      talking_points_count: result.talking_points_count,
      policy_positions_count: result.policy_positions_count,
      transcript_length: result.transcript_length,
    });
  } catch (error: any) {
    console.error('[VideoProcess] Processing error:', error.message);
    // The processVideoTrainingSource function already marks the record as 'failed',
    // so we just return the error message to the client.
    return NextResponse.json({ 
      error: error.message,
      suggestion: 'Check that the video file is accessible and OPENAI_API_KEY is configured.'
    }, { status: 500 });
  }
}
