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
  // Show ALL competitors with their IDs
  const { data: comps } = await supabase.from('competitors').select('id, name, party, threat_level').eq('tenant_id', 'bottoms-2026');
  console.log("ALL COMPETITORS:");
  for (const c of comps || []) {
    console.log(`  ${c.name} (${c.party}) [${c.threat_level}] -> ID: ${c.id}`);
  }

  console.log("\n");

  // Show ALL competitor activities with their competitor_id
  const { data: acts } = await supabase.from('competitor_activities').select('id, summary, competitor_id, source_url');
  console.log("ALL ACTIVITIES:");
  for (const a of acts || []) {
    console.log(`  competitor_id: ${a.competitor_id} -> ${a.summary}`);
    console.log(`    source: ${a.source_url}`);
  }

  // Check if competitor_id values in activities match any competitor IDs
  console.log("\nMATCH CHECK:");
  const compIds = new Set((comps || []).map(c => c.id));
  for (const a of acts || []) {
    const matches = compIds.has(a.competitor_id);
    console.log(`  ${a.competitor_id} -> ${matches ? '✅ MATCHES' : '❌ NO MATCH'} a competitor`);
  }
}
run();
