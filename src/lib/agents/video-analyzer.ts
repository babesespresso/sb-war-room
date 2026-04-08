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

  const videoBlob = await videoResponse.blob();

  // Whisper API has a 25MB limit per request.
  // For larger files we would need to chunk, but for now we enforce upload limits.
  const MAX_WHISPER_SIZE = 25 * 1024 * 1024; // 25MB
  if (videoBlob.size > MAX_WHISPER_SIZE) {
    // Extract audio first to reduce file size, or chunk
    // For now, try sending as-is since many videos compress well as audio
    console.warn(`[VideoAnalyzer] Video is ${(videoBlob.size / 1024 / 1024).toFixed(1)}MB, Whisper limit is 25MB. Attempting anyway...`);
  }

  const formData = new FormData();
  formData.append('file', videoBlob, 'video.mp4');
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
    await db.from('video_training_sources')
      .update({ processing_status: 'transcribing', updated_at: new Date().toISOString() })
      .eq('id', videoId);

    // 3. Transcribe
    console.log(`[VideoAnalyzer] Transcribing video: ${video.title}`);
    const { transcript, segments } = await transcribeVideo(video.video_url);

    // 4. Save transcript, update status to analyzing
    await db.from('video_training_sources')
      .update({
        transcript,
        transcript_segments: segments,
        processing_status: 'analyzing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId);

    // 5. Analyze transcript with Claude
    console.log(`[VideoAnalyzer] Analyzing transcript: ${transcript.length} chars`);
    const analysis = await analyzeTranscript(transcript, video.title, tenantId);

    // 6. Save analysis results, mark as completed
    await db.from('video_training_sources')
      .update({
        extracted_talking_points: analysis.talking_points,
        extracted_voice_patterns: analysis.voice_patterns,
        extracted_policy_positions: analysis.policy_positions,
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId);

    console.log(`[VideoAnalyzer] Completed: ${analysis.talking_points.length} talking points, ${analysis.policy_positions.length} positions extracted`);

    return {
      success: true,
      talking_points_count: analysis.talking_points.length,
      policy_positions_count: analysis.policy_positions.length,
      transcript_length: transcript.length,
    };
  } catch (error: any) {
    // Mark as failed
    await db.from('video_training_sources')
      .update({
        processing_status: 'failed',
        processing_error: error.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId);

    throw error;
  }
}
