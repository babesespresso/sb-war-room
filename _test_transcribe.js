// Test the transcription pipeline step by step
const fs = require('fs');

// Load env
if (fs.existsSync('.env.local')) {
  const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.substring(0, eq).trim();
    let v = t.substring(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    // Remove trailing \n that might be in the key
    v = v.replace(/\\n$/, '').trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const videoUrl = process.argv[2];

async function test() {
  console.log('=== Step 1: Check OpenAI API Key ===');
  const apiKey = (process.env.OPENAI_API_KEY || '').trim().replace(/\\n$/, '');
  console.log('Key present:', !!apiKey);
  console.log('Key length:', apiKey.length);
  console.log('Key starts with:', apiKey.substring(0, 10) + '...');
  console.log('Key ends with:', '...' + apiKey.substring(apiKey.length - 5));
  
  if (!videoUrl) {
    console.log('\nNo video URL provided. Usage: node _test_transcribe.js <video_url>');
    // Use the stuck video URL from the database
    console.log('\nAttempting to use the stuck video from DB...');
    
    const { createClient } = require('@supabase/supabase-js');
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    
    const { data: video } = await db
      .from('video_training_sources')
      .select('id, title, video_url, processing_status')
      .eq('processing_status', 'transcribing')
      .limit(1)
      .single();
      
    if (!video) {
      console.log('No stuck video found');
      return;
    }
    
    console.log('\n=== Step 2: Fetch Video from Storage ===');
    console.log('Video:', video.title);
    console.log('URL:', video.video_url.substring(0, 80) + '...');
    
    const fetchStart = Date.now();
    const response = await fetch(video.video_url);
    const fetchTime = Date.now() - fetchStart;
    console.log('Fetch status:', response.status);
    console.log('Fetch time:', fetchTime + 'ms');
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('Content-Length:', response.headers.get('content-length'));
    
    if (!response.ok) {
      console.log('FAILED to fetch video:', response.statusText);
      return;
    }
    
    const buffer = await response.arrayBuffer();
    console.log('File size:', (buffer.byteLength / 1024 / 1024).toFixed(2) + ' MB');
    
    console.log('\n=== Step 3: Send to Whisper API ===');
    const file = new File([buffer], 'video.mp3', { type: 'audio/mp3' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('language', 'en');
    
    console.log('Sending to Whisper API...');
    const whisperStart = Date.now();
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.log('TIMEOUT after 30 seconds - Whisper API is hanging!');
        controller.abort();
      }, 30000);
      
      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      const whisperTime = Date.now() - whisperStart;
      console.log('Whisper status:', whisperRes.status);
      console.log('Whisper time:', whisperTime + 'ms');
      
      if (!whisperRes.ok) {
        const errBody = await whisperRes.text();
        console.log('Whisper ERROR:', errBody);
      } else {
        const result = await whisperRes.json();
        console.log('Transcript length:', result.text?.length || 0, 'chars');
        console.log('First 200 chars:', result.text?.substring(0, 200));
        console.log('Segments:', result.segments?.length || 0);
        console.log('\n✅ Transcription succeeded!');
      }
    } catch (err) {
      console.log('Whisper EXCEPTION:', err.message);
      if (err.name === 'AbortError') {
        console.log('\n❌ The Whisper API call is HANGING (timed out after 30s)');
        console.log('This is likely a Node.js native fetch issue with FormData + large files');
      }
    }
  }
}

test().catch(err => console.error('Fatal:', err));
