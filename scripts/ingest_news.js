/**
 * Initial news ingestion using NewsData.io API
 * Pulls real, current political news for all candidates in the race.
 * Run this to populate the War Room with actual intelligence.
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

// Targeted political queries for EVERY candidate and the race overall
const QUERIES = [
  // Our candidate
  '"Scott Bottoms" Colorado',
  // Top Republican threats
  '"Victor Marx" Colorado governor',
  '"Barbara Kirkmeyer" Colorado',
  // Democrat threats (general election)
  '"Michael Bennet" Colorado governor',
  '"Phil Weiser" Colorado governor',
  // Endorsers / recent dropouts
  '"Joe Oltmann" Colorado',
  '"Jason Mikesell" Colorado',
  // Other candidates
  '"Greg Lopez" Colorado governor',
  '"Josh Griffin" Colorado governor',
  // Broad race queries
  'Colorado governor race 2026',
  'Colorado Republican primary governor',
  'Colorado Democratic primary governor 2026',
];

async function fetchNewsDataIO(query) {
  if (!NEWSDATA_API_KEY) {
    console.error('❌ NEWSDATA_API_KEY not found in .env.local');
    process.exit(1);
  }

  const params = new URLSearchParams({
    apikey: NEWSDATA_API_KEY,
    q: query,
    country: 'us',
    language: 'en',
    size: '10',
  });

  const res = await fetch(`${NEWSDATA_BASE}?${params.toString()}`);

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) {
      console.warn('⚠️  Rate limited. Waiting 60 seconds...');
      await new Promise(r => setTimeout(r, 60000));
      return [];
    }
    console.error(`  ❌ API error (${res.status}): ${errText.substring(0, 200)}`);
    return [];
  }

  const data = await res.json();
  if (data.status !== 'success') {
    console.error(`  ❌ API returned status: ${data.status}`);
    return [];
  }

  return data.results || [];
}

async function run() {
  console.log(`🔍 Starting NewsData.io Political News Ingestion`);
  console.log(`   API Key: ${NEWSDATA_API_KEY ? NEWSDATA_API_KEY.substring(0, 10) + '...' : 'MISSING'}`);
  console.log(`   Queries: ${QUERIES.length}`);
  console.log('');

  // Get existing URLs to avoid duplicates
  const { data: existing } = await supabase
    .from('news_items')
    .select('source_url')
    .eq('tenant_id', TENANT_ID);

  const existingUrls = new Set((existing || []).map(e => e.source_url));
  console.log(`📊 ${existingUrls.size} existing news items in DB\n`);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const seenUrls = new Set();

  for (const query of QUERIES) {
    console.log(`🔎 Querying: "${query}"`);

    try {
      const results = await fetchNewsDataIO(query);
      console.log(`   Found ${results.length} results`);

      for (const item of results) {
        if (!item.link || !item.title) continue;
        if (seenUrls.has(item.link) || existingUrls.has(item.link)) {
          totalSkipped++;
          continue;
        }
        seenUrls.add(item.link);

        // Determine relevance score based on content
        const text = `${item.title} ${item.description || ''} ${item.content || ''}`.toLowerCase();
        let relevanceScore = 30; // default

        // Check for candidate/competitor mentions
        const candidateMentions = ['scott bottoms', 'bottoms for governor', 'bottoms campaign'];
        const competitorMentions = {
          'michael bennet': 80,
          'phil weiser': 75,
          'victor marx': 75,
          'barbara kirkmeyer': 70,
          'joe oltmann': 60,
          'jason mikesell': 60,
          'greg lopez': 55,
          'josh griffin': 50,
        };

        let mentionsCandidate = false;
        for (const mention of candidateMentions) {
          if (text.includes(mention)) {
            relevanceScore = 95;
            mentionsCandidate = true;
            break;
          }
        }

        if (!mentionsCandidate) {
          for (const [name, score] of Object.entries(competitorMentions)) {
            if (text.includes(name)) {
              relevanceScore = Math.max(relevanceScore, score);
              break;
            }
          }
        }

        // Colorado governor race boost
        if (text.includes('colorado governor') || text.includes('gubernatorial')) {
          relevanceScore = Math.max(relevanceScore, 70);
        }

        // Determine source type
        const sourceLower = (item.source_name || '').toLowerCase();
        let sourceType = 'online';
        if (sourceLower.includes('post') || sourceLower.includes('sun') || sourceLower.includes('gazette') || sourceLower.includes('times'))
          sourceType = 'newspaper';
        else if (sourceLower.includes('news') || sourceLower.includes('fox') || sourceLower.includes('cbs') || sourceLower.includes('nbc'))
          sourceType = 'tv';
        else if (sourceLower.includes('ap') || sourceLower.includes('reuters') || sourceLower.includes('upi'))
          sourceType = 'wire';

        // Determine sentiment
        let sentiment = 'neutral';
        if (item.sentiment === 'positive') sentiment = 'positive';
        else if (item.sentiment === 'negative') sentiment = 'negative';

        // Determine topics
        const topics = [];
        if (text.includes('water') || text.includes('drought')) topics.push('water_policy');
        if (text.includes('tax') || text.includes('economy') || text.includes('economic')) topics.push('economy');
        if (text.includes('housing') || text.includes('rent') || text.includes('home')) topics.push('housing');
        if (text.includes('education') || text.includes('school')) topics.push('education');
        if (text.includes('health') || text.includes('medicare') || text.includes('medicaid')) topics.push('healthcare');
        if (text.includes('immigra') || text.includes('border')) topics.push('immigration');
        if (text.includes('crime') || text.includes('police') || text.includes('safety')) topics.push('public_safety');
        if (text.includes('energy') || text.includes('oil') || text.includes('gas') || text.includes('renewable')) topics.push('energy');
        if (text.includes('endorse') || text.includes('drops out') || text.includes('campaign')) topics.push('campaign');
        if (text.includes('trump')) topics.push('national_politics');
        if (topics.length === 0) topics.push('colorado_politics');

        const { error } = await supabase.from('news_items').insert({
          tenant_id: TENANT_ID,
          headline: item.title.substring(0, 500),
          summary: (item.description || item.title).substring(0, 1000),
          source_name: item.source_name || item.source_id || 'Unknown',
          source_url: item.link,
          published_at: item.pubDate || new Date().toISOString(),
          topics,
          relevance_score: relevanceScore,
          sentiment,
          mentions_candidate: mentionsCandidate,
          response_opportunity: relevanceScore >= 70,
          response_urgency: relevanceScore >= 90 ? 'high' : relevanceScore >= 70 ? 'medium' : 'low',
          is_processed: true,
        });

        if (error) {
          console.error(`   ❌ Insert error: ${error.message}`);
        } else {
          totalInserted++;
        }
      }

      totalFetched += results.length;

      // Rate limiting: stay within free tier (30 credits per 15 min)
      await new Promise(r => setTimeout(r, 1500));

    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }

  console.log('\n========================================');
  console.log(`✅ INGESTION COMPLETE`);
  console.log(`   Total fetched: ${totalFetched}`);
  console.log(`   New inserted:  ${totalInserted}`);
  console.log(`   Skipped (dupes): ${totalSkipped}`);
  console.log('========================================');

  // Show final counts
  const { count } = await supabase
    .from('news_items')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  console.log(`\n📊 Total news items in DB: ${count}`);

  // Show items by relevance
  const { data: highRel } = await supabase
    .from('news_items')
    .select('headline, relevance_score, source_name, mentions_candidate')
    .eq('tenant_id', TENANT_ID)
    .gte('relevance_score', 50)
    .order('relevance_score', { ascending: false })
    .limit(20);

  if (highRel?.length) {
    console.log(`\n🔥 TOP POLITICAL ARTICLES (relevance >= 50):`);
    for (const item of highRel) {
      const flag = item.mentions_candidate ? '⭐' : '  ';
      console.log(`  ${flag} [${item.relevance_score}] ${item.headline.substring(0, 80)} (${item.source_name})`);
    }
  }
}

run().catch(console.error);
