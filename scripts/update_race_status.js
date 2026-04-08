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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const tid = 'bottoms-2026';

async function run() {
  // 1. Mark Joe Oltmann as endorser
  const { data: oltmann } = await supabase.from('competitors')
    .update({
      role: 'endorser',
      threat_level: 'low',
      messaging_profile: {
        core_themes: ['party reform', 'election integrity', 'anti-establishment'],
        attack_vectors: [],
        key_policies: ['eliminate mail-in ballots', 'DOGE-style state government cuts'],
        tone: 'aggressive, anti-establishment firebrand',
        endorsement: 'Endorsed Scott Bottoms for Governor, March 2026',
        status: 'Dropped out of governor race, running for CO GOP Chair',
        last_updated: '2026-04-04'
      }
    })
    .eq('tenant_id', tid)
    .eq('name', 'Joe Oltmann')
    .select('id, name');
  
  console.log('Updated Oltmann:', oltmann);

  // 2. Mark Jason Mikesell as endorser
  const { data: mikesell } = await supabase.from('competitors')
    .update({
      role: 'endorser',
      threat_level: 'low',
      messaging_profile: {
        core_themes: ['law and order', 'immigration enforcement', 'public safety'],
        attack_vectors: [],
        key_policies: ['eliminate sanctuary policies', 'ICE cooperation', 'crime reduction'],
        tone: 'tough, law enforcement authority',
        endorsement: 'Endorsed Scott Bottoms for Governor, dropped out of race',
        status: 'Dropped out of governor race',
        last_updated: '2026-04-04'
      }
    })
    .eq('tenant_id', tid)
    .eq('name', 'Jason Mikesell')
    .select('id, name');
  
  console.log('Updated Mikesell:', mikesell);

  // 3. Log endorsements as positive competitor activities
  if (oltmann?.[0]) {
    await supabase.from('competitor_activities').insert({
      tenant_id: tid,
      competitor_id: oltmann[0].id,
      activity_type: 'endorsement',
      platform: 'news',
      summary: 'Joe Oltmann drops out of governor race, endorses Scott Bottoms',
      raw_content: 'Joe Oltmann announced he is dropping out of the Colorado gubernatorial race and endorsing fellow Republican Scott Bottoms. Oltmann is pivoting to run for CO GOP Chair.',
      source_url: null,
      detected_at: '2026-03-28T12:00:00Z',
      topics: ['endorsement', 'party_politics'],
      threat_level: 'low',
      requires_response: false,
      sentiment: 'positive'
    });
    console.log('✅ Created Oltmann endorsement activity');
  }

  if (mikesell?.[0]) {
    await supabase.from('competitor_activities').insert({
      tenant_id: tid,
      competitor_id: mikesell[0].id,
      activity_type: 'endorsement',
      platform: 'news',
      summary: 'Jason Mikesell drops out of governor race, endorses Scott Bottoms',
      raw_content: 'Teller County Sheriff Jason Mikesell has ended his gubernatorial campaign and endorsed Scott Bottoms, citing alignment on law enforcement and public safety priorities.',
      source_url: null,
      detected_at: '2026-03-28T12:00:00Z',
      topics: ['endorsement', 'public_safety'],
      threat_level: 'low',
      requires_response: false,
      sentiment: 'positive'
    });
    console.log('✅ Created Mikesell endorsement activity');
  }

  // 4. Verify all competitors final state
  const { data: allComps } = await supabase.from('competitors')
    .select('name, party, role, threat_level, is_active')
    .eq('tenant_id', tid)
    .order('threat_level', { ascending: false });

  console.log('\n=== FINAL COMPETITOR STATUS ===');
  for (const c of allComps || []) {
    const status = c.role === 'endorser' ? '🤝 ENDORSER' : c.is_active ? '⚔️ ACTIVE' : '❌ INACTIVE';
    console.log(`  ${status} ${c.name} (${c.party}) [${c.threat_level}] role=${c.role}`);
  }
}

run().catch(console.error);
