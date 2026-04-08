import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/persona/video/init-upload
 * Ensures the storage bucket exists and returns upload config.
 * The client then uploads directly to Supabase Storage.
 */
export async function POST() {
  try {
    const db = createServiceClient();

    // Check if bucket already exists
    const { data: buckets } = await db.storage.listBuckets();
    const bucketExists = buckets?.some((b: any) => b.name === 'video-training');

    if (!bucketExists) {
      // Create bucket WITHOUT file size limit - Supabase will use the plan default
      const { error: createErr } = await db.storage.createBucket('video-training', {
        public: false,
      });

      if (createErr) {
        // If it already exists (race condition), that's fine
        if (!createErr.message?.includes('already exists')) {
          console.error('[VideoAPI] Bucket creation error:', createErr.message);
          throw new Error(`Failed to create storage bucket: ${createErr.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      bucket: 'video-training',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  } catch (error: any) {
    console.error('[VideoAPI] Init-upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
