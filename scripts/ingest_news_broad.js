/**
 * Second-pass broader news ingestion for candidates with no results.
 * Uses broader queries that are more likely to return results.
 */
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

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const NEWSDATA_BASE = 'https://newsdata.io/api/1/latest';
const TENANT_ID = 'bottoms-2026';

// Broader queries for candidates that had 0 results with exact match
const QUERIES = [
  // Broader Colorado gubernatorial coverage
  'Colorado governor election',
  'Colorado gubernatorial primary',
  'Colorado GOP governor',
  // Key issues in the race
  'Colorado water policy debate',
  'Colorado economy jobs governor',
  'Colorado immigration policy',
  'Colorado housing crisis',
  // Broader political coverage
  'Colorado Republican primary 2026',
  'Colorado political news',
];

async function fetchNewsDataIO(query) {
  const params = new URLSearchParams({
    apikey: NEWSDATA_API_KEY,
    q: query,
    country: 'us',
    language: 'en',
    size: '10',
  });

  const res = await fetch(`${NEWSDATA_BASE}?${params.toString()}`);

  if (!res.ok) {
    if (res.status === 429) {
      console.warn('⚠️  Rate limited. Stopping.');
      return null; // signal to stop
    }
    const errText = await res.text();
    console.error(`  ❌ API error (${res.status}): ${errText.substring(0, 200)}`);
    return [];
  }

  const data = await res.json();
  return data.status === 'success' ? (data.results || []) : [];
}

async function run() {
  console.log(`🔍 Broader Political News Ingestion (Pass 2)`);

  const { data: existing } = await supabase
    .from('news_items')
    .select('source_url')
    .eq('tenant_id', TENANT_ID);

  const existingUrls = new Set((existing || []).map(e => e.source_url));
  const seenUrls = new Set();
  let totalInserted = 0;

  for (const query of QUERIES) {
    console.log(`🔎 "${query}"`);

    const results = await fetchNewsDataIO(query);
    if (results === null) break; // rate limited
    console.log(`   → ${(results || []).length} results`);

    for (const item of (results || [])) {
      if (!item.link || !item.title) continue;
      if (seenUrls.has(item.link) || existingUrls.has(item.link)) continue;
      seenUrls.add(item.link);

      const text = `${item.title} ${item.description || ''} ${item.content || ''}`.toLowerCase();
      let relevanceScore = 30;
      let mentionsCandidate = false;

      // Score by content
      if (text.includes('scott bottoms')) { relevanceScore = 95; mentionsCandidate = true; }
      else if (text.includes('governor') && text.includes('colorado')) relevanceScore = Math.max(relevanceScore, 65);
      else if (text.includes('colorado') && (text.includes('republican') || text.includes('democrat'))) relevanceScore = Math.max(relevanceScore, 55);

      // Competitor name boost
      const names = ['michael bennet', 'phil weiser', 'victor marx', 'barbara kirkmeyer', 'greg lopez', 'joe oltmann', 'jason mikesell'];
      for (const name of names) {
        if (text.includes(name)) { relevanceScore = Math.max(relevanceScore, 75); break; }
      }

      // Topic extraction
      const topics = [];
      if (text.includes('water') || text.includes('drought')) topics.push('water_policy');
      if (text.includes('tax') || text.includes('economy')) topics.push('economy');
      if (text.includes('housing')) topics.push('housing');
      if (text.includes('education')) topics.push('education');
      if (text.includes('health')) topics.push('healthcare');
      if (text.includes('immigra') || text.includes('border')) topics.push('immigration');
      if (text.includes('crime') || text.includes('safety')) topics.push('public_safety');
      if (text.includes('energy')) topics.push('energy');
      if (topics.length === 0) topics.push('colorado_politics');

      const { error } = await supabase.from('news_items').insert({
        tenant_id: TENANT_ID,
        headline: item.title.substring(0, 500),
        summary: (item.description || item.title).substring(0, 1000),
        source_name: item.source_name || 'Unknown',
        source_url: item.link,
        published_at: item.pubDate || new Date().toISOString(),
        topics,
        relevance_score: relevanceScore,
        sentiment: 'neutral',
        mentions_candidate: mentionsCandidate,
        response_opportunity: relevanceScore >= 60,
        response_urgency: relevanceScore >= 80 ? 'medium' : 'low',
        is_processed: true,
      });

      if (!error) totalInserted++;
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n✅ Pass 2 complete: ${totalInserted} new articles added`);

  const { count } = await supabase
    .from('news_items')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);
  console.log(`📊 Total news items in DB: ${count}`);
}

run().catch(console.error);
