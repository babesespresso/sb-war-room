import { runAgent } from './runner';
import { createServiceClient, DEFAULT_TENANT } from '@/lib/supabase/client';

const TRANSCRIPTION_ANALYSIS_PROMPT = `You are an expert political communications analyst. You are given the transcript of a video of a political candidate.

Your job is to extract EVERYTHING useful for training an AI to write content that sounds exactly like this candidate.

Analyze the transcript and extract:

1. TALKING POINTS: Specific policy positions, arguments, or messaging lines the candidate uses. Include the exact quote from the transcript.

2. VOICE PATTERNS: How the candidate speaks. Common phrases, rhetorical devices (repetition, tricolon, call-and-response), typical sentence length, and tone characteristics.

3. POLICY POSITIONS: Any policy stances mentioned, with supporting quotes.

4. KEY PHRASES: Signature phrases the candidate returns to repeatedly. These are the phrases that make content sound authentically like this candidate.

Respond ONLY with valid JSON:
{
  "talking_points": [
    {
      "topic": "the policy area (e.g. 'water_policy', 'economy', 'parental_rights', 'energy', 'public_safety', 'education', 'healthcare', 'immigration', 'government_transparency')",
      "point": "A concise summary of the talking point",
      "quote": "The EXACT quote from the transcript, word for word",
      "confidence": 0.95
    }
  ],
  "voice_patterns": {
    "common_phrases": ["phrase 1", "phrase 2"],
    "rhetorical_devices": ["device 1: example", "device 2: example"],
    "tone_notes": "Description of the candidate's tone and delivery style",
    "avg_sentence_length": 12
  },
  "policy_positions": [
    {
      "topic": "topic area",
      "position": "Summary of the position",
      "supporting_quote": "Exact quote from transcript"
    }
  ]
}

IMPORTANT:
- Extract at minimum 5 talking points and 3 policy positions if the content supports it.
- Quotes must be EXACT from the transcript. Do not paraphrase.
- Confidence should reflect how clearly the candidate articulated the point (0.5 = vague, 1.0 = crystal clear).
- Topics should map to: economy, jobs, taxes, housing, water_policy, energy, education, healthcare, immigration, public_safety, infrastructure, environment, gun_policy, election_integrity, government_spending, veterans, agriculture, tech_innovation, drug_policy, constitutional_rights, parental_rights, government_transparency.`;

/**
 * Transcribe a video using OpenAI Whisper API.
 * For videos stored as URLs, we fetch the file first.
 */
export async function transcribeVideo(videoUrl: string): Promise<{
  transcript: string;
  segments: Array<{ start: number; end: number; text: string }>;
}> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for video transcription');
  }

  // Fetch the video file from Supabase Storage
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to fetch video from storage: ${videoResponse.status}`);
  }

  const videoArrayBuffer = await videoResponse.arrayBuffer();
  
  // Whisper API has a 25MB limit per request.
  const MAX_WHISPER_SIZE = 25 * 1024 * 1024; // 25MB
  if (videoArrayBuffer.byteLength > MAX_WHISPER_SIZE) {
    console.warn(`[VideoAnalyzer] Video is ${(videoArrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB, Whisper limit is 25MB. Attempting anyway...`);
  }

  // Construct a native File object to ensure Node.js fetch properly encodes the multipart boundary.
  // raw Blobs often hang the OpenAI API connection in Node native fetch.
  const file = new File([videoArrayBuffer], 'video.mp3', { type: 'audio/mp3' });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'en');

  const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!whisperResponse.ok) {
    const errBody = await whisperResponse.text();
    throw new Error(`Whisper API failed (${whisperResponse.status}): ${errBody}`);
  }

  const result = await whisperResponse.json();

  return {
    transcript: result.text || '',
    segments: (result.segments || []).map((seg: any) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })),
  };
}

/**
 * Analyze a transcript using Claude to extract talking points,
 * voice patterns, and policy positions.
 */
export async function analyzeTranscript(
  transcript: string,
  videoTitle: string,
  tenantId = DEFAULT_TENANT
) {
  const result = await runAgent(
    {
      name: 'video_analyzer',
      tenantId,
      systemPrompt: TRANSCRIPTION_ANALYSIS_PROMPT,
      maxTokens: 8192,
    },
    `VIDEO TITLE: "${videoTitle}"\n\nFULL TRANSCRIPT:\n${transcript}`,
    'triggered'
  );

  if (!result.parsed) {
    throw new Error('Video analyzer did not return valid JSON');
  }

  return {
    talking_points: result.parsed.talking_points || [],
    voice_patterns: result.parsed.voice_patterns || {},
    policy_positions: result.parsed.policy_positions || [],
    runId: result.runId,
    tokensUsed: result.tokensInput + result.tokensOutput,
  };
}

/**
 * Full pipeline: transcribe video, analyze transcript, update database record.
 */
export async function processVideoTrainingSource(
  videoId: string,
  tenantId = DEFAULT_TENANT
) {
  const db = createServiceClient();

  // 1. Get the video record
  const { data: video, error: fetchErr } = await db
    .from('video_training_sources')
    .select('*')
    .eq('id', videoId)
    .single();

  if (fetchErr || !video) {
    throw new Error(`Video ${videoId} not found: ${fetchErr?.message}`);
  }

  try {
    // 2. Update status to transcribing
    console.log(`[VideoAnalyzer] Setting status to 'transcribing' for ${videoId}...`);
    const { error: statusErr1 } = await db.from('video_training_sources')
      .update({ processing_status: 'transcribing', updated_at: new Date().toISOString() })
      .eq('id', videoId);
    if (statusErr1) {
      throw new Error(`DB update to 'transcribing' failed: ${statusErr1.message}`);
    }

    // 3. Transcribe
    console.log(`[VideoAnalyzer] Transcribing video: ${video.title}`);
    const { transcript, segments } = await transcribeVideo(video.video_url);
    console.log(`[VideoAnalyzer] Transcription complete: ${transcript.length} chars, ${segments.length} segments`);

    // 4. Save transcript, update status to analyzing
    console.log(`[VideoAnalyzer] Saving transcript and setting status to 'analyzing'...`);
    const { error: statusErr2 } = await db.from('video_training_sources')
      .update({
        transcript,
        processing_status: 'analyzing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId);
    if (statusErr2) {
      throw new Error(`DB update to 'analyzing' failed: ${statusErr2.message}`);
    }

    // 5. Analyze transcript with Claude
    console.log(`[VideoAnalyzer] Analyzing transcript with Claude...`);
    const analysis = await analyzeTranscript(transcript, video.title, tenantId);
    console.log(`[VideoAnalyzer] Analysis complete: ${analysis.talking_points.length} talking points, ${analysis.policy_positions.length} positions`);

    // 6. Save analysis results, mark as completed
    console.log(`[VideoAnalyzer] Saving analysis results and marking as 'completed'...`);
    const { error: statusErr3 } = await db.from('video_training_sources')
      .update({
        extracted_talking_points: analysis.talking_points,
        extracted_voice_patterns: analysis.voice_patterns,
        extracted_policy_positions: analysis.policy_positions,
        processing_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId);
    if (statusErr3) {
      throw new Error(`DB update to 'completed' failed: ${statusErr3.message}`);
    }

    console.log(`[VideoAnalyzer] ✅ Completed: ${analysis.talking_points.length} talking points, ${analysis.policy_positions.length} positions extracted`);

    return {
      success: true,
      talking_points_count: analysis.talking_points.length,
      policy_positions_count: analysis.policy_positions.length,
      transcript_length: transcript.length,
    };
  } catch (error: any) {
    console.error(`[VideoAnalyzer] ❌ Failed for ${videoId}:`, error.message);
    // Mark as failed
    const { error: failErr } = await db.from('video_training_sources')
      .update({
        processing_status: 'failed',
        processing_error: error.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId);
    if (failErr) {
      console.error(`[VideoAnalyzer] Failed to mark as failed:`, failErr.message);
    }

    throw error;
  }
}
