const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load env
const envFiles = ['.env.local', '.env.production.local'];
for (const envFile of envFiles) {
  try {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const l of lines) {
      const t = l.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      let k = t.substring(0, eq).trim();
      let v = t.substring(eq + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      v = v.replace(/\\n$/, '');
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function resetStuckVideos() {
  // Find all stuck videos (not completed and not 'uploaded')
  const { data: stuck } = await db.from('video_training_sources')
    .select('id, title, processing_status, processing_error')
    .in('processing_status', ['transcribing', 'analyzing', 'failed']);

  if (!stuck || stuck.length === 0) {
    console.log('No stuck videos found.');
    return;
  }

  console.log(`Found ${stuck.length} stuck video(s):`);
  for (const v of stuck) {
    console.log(`  - "${v.title}" [${v.processing_status}] ${v.processing_error || ''}`);
  }

  // Reset all to 'uploaded' so they can be reprocessed
  const ids = stuck.map(v => v.id);
  const { error } = await db.from('video_training_sources')
    .update({ 
      processing_status: 'uploaded', 
      processing_error: null,
      updated_at: new Date().toISOString()
    })
    .in('id', ids);

  if (error) {
    console.error('Reset failed:', error.message);
  } else {
    console.log(`\n✅ Reset ${ids.length} video(s) to 'uploaded'. They will be reprocessed on next upload trigger.`);
    console.log('\nTo reprocess them now, visit the AI Persona page and the polling will trigger reprocessing.');
  }
}

resetStuckVideos().catch(err => console.error('Fatal:', err));
