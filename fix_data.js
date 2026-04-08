const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tid = 'bottoms-2026';

  // ===== FIX 1: Fix broken Facebook source URL =====
  console.log('=== FIX 1: Update broken Facebook URL ===');
  const { data: marxAct } = await supabase.from('competitor_activities')
    .select('id, source_url')
    .eq('tenant_id', tid)
    .eq('source_url', 'https://facebook.com/coloradoGOP');
  
  if (marxAct && marxAct.length > 0) {
    // Update to Victor Marx's actual public Facebook page
    const { error } = await supabase.from('competitor_activities')
      .update({ source_url: 'https://www.facebook.com/people/Victor-Marx/61558648398555/' })
      .eq('source_url', 'https://facebook.com/coloradoGOP')
      .eq('tenant_id', tid);
    console.log(`  Updated ${marxAct.length} activities: ${error ? 'ERROR: ' + error.message : '✅ OK'}`);
  } else {
    console.log('  No broken Facebook URLs found');
  }

  // ===== FIX 2: Deduplicate news items =====
  console.log('\n=== FIX 2: Deduplicate news items ===');
  const { data: allNews } = await supabase.from('news_items')
    .select('id, headline, source_url, published_at')
    .eq('tenant_id', tid)
    .order('published_at', { ascending: false });

  const seen = new Map();
  let dupsDeleted = 0;
  for (const item of (allNews || [])) {
    const key = item.source_url || item.headline; // dedupe by URL first, then headline
    if (seen.has(key)) {
      await supabase.from('news_items').delete().eq('id', item.id);
      dupsDeleted++;
    } else {
      seen.set(key, item.id);
    }
  }
  console.log(`  Deleted ${dupsDeleted} duplicate news items`);

  // ===== VERIFY =====
  console.log('\n=== VERIFICATION ===');
  const { data: finalActs } = await supabase.from('competitor_activities')
    .select('summary, source_url')
    .eq('tenant_id', tid);
  console.log(`Competitor Activities (${finalActs?.length}):`);
  for (const a of finalActs || []) {
    console.log(`  ✅ ${a.summary}`);
    console.log(`     URL: ${a.source_url}`);
  }

  const { data: finalNews, count } = await supabase.from('news_items')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tid);
  console.log(`\nNews items total: ${count}`);
}

run().catch(console.error);
