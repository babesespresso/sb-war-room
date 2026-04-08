const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load .env.local manually (no dotenv dependency required)
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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const tenant_id = 'bottoms-2026';

  // Verify tenant exists
  const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenant_id).single();
  if (!tenant) {
    console.error(`Tenant '${tenant_id}' not found. Run migrations first.`);
    process.exit(1);
  }
  
  // Get Competitors (use name to avoid cross-tenant issues)
  const { data: compR } = await supabase.from('competitors').select('id')
    .eq('tenant_id', tenant_id).eq('party', 'Republican').limit(1).single();
  const { data: compD } = await supabase.from('competitors').select('id')
    .eq('tenant_id', tenant_id).eq('party', 'Democrat').limit(1).single();

  // 1. Competitor Activities
  // NOTE: activity_type must match schema CHECK constraint:
  // social_post, press_release, policy_announcement, endorsement, attack,
  // ad_campaign, event, filing, media_appearance
  const activities = [];
  if (compD?.id) {
    activities.push({
      tenant_id, competitor_id: compD.id, activity_type: 'attack', 
      summary: 'Attacked Scott on Water Policy', 
      raw_content: 'Scott Bottoms wants to dry up our farms with his new water policy...', 
      detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), 
      topics: ['water_policy', 'agriculture'], threat_level: 'high', requires_response: true
    });
    activities.push({
      tenant_id, competitor_id: compD.id, activity_type: 'press_release', 
      summary: 'Announced new housing initiative', 
      raw_content: 'We are allocating $500M to urban housing...', 
      detected_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), 
      topics: ['housing'], threat_level: 'medium', requires_response: false
    });
  }
  if (compR?.id) {
    activities.push({
      tenant_id, competitor_id: compR.id, activity_type: 'event', 
      summary: 'Criticized current tax rates at local rally', 
      raw_content: 'Taxes are too high and hurting small business...', 
      detected_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), 
      topics: ['economy', 'taxes'], threat_level: 'critical', requires_response: true
    });
  }
  if (activities.length > 0) {
    const { error } = await supabase.from('competitor_activities').insert(activities);
    if (error) console.error('Activities insert error:', error.message);
    else console.log(`Inserted ${activities.length} competitor activities`);
  }

  // 2. News Items
  const { error: newsErr } = await supabase.from('news_items').insert([
    { tenant_id, headline: 'Local Farms Face Water Crisis', summary: 'A deep dive into the upcoming water shortages...', source_name: 'Colorado Sun', published_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), topics: ['water_policy', 'economy'], relevance_score: 85, sentiment: 'negative', response_opportunity: true, response_urgency: 'high' },
    { tenant_id, headline: 'Economic Growth Exceeds Expectations in Q1', summary: 'State sees unexpected bump in jobs...', source_name: 'Denver Post', published_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), topics: ['economy', 'jobs'], relevance_score: 90, sentiment: 'positive', response_opportunity: true, response_urgency: 'medium' }
  ]);
  if (newsErr) console.error('News insert error:', newsErr.message);
  else console.log('Inserted 2 news items');

  // 3. Sentiment Signals
  const { error: sentErr } = await supabase.from('sentiment_signals').insert([
    { tenant_id, platform: 'twitter', topic: 'water_policy', sentiment_score: -0.4, volume: 1500, velocity: 2.5, opportunity_score: 85, candidate_alignment: 'strong', period_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), period_end: new Date().toISOString() },
    { tenant_id, platform: 'news', topic: 'economy', sentiment_score: 0.6, volume: 3200, velocity: 1.2, opportunity_score: 60, candidate_alignment: 'moderate', period_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), period_end: new Date().toISOString() },
    { tenant_id, platform: 'facebook', topic: 'public_safety', sentiment_score: -0.2, volume: 800, velocity: 0.5, opportunity_score: 40, candidate_alignment: 'strong', period_start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), period_end: new Date().toISOString() }
  ]);
  if (sentErr) console.error('Sentiment insert error:', sentErr.message);
  else console.log('Inserted 3 sentiment signals');

  // 4. Content Drafts
  const { error: draftErr } = await supabase.from('content_drafts').insert([
    { tenant_id, content_type: 'social_twitter', title: 'Water Policy Response', body: 'Our agriculture relies on strong water rights. I will defend Colorado water. #CoPol', status: 'pending_review', platform: 'twitter', suggested_post_time: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
    { tenant_id, content_type: 'social_facebook', title: 'Economy Highlight', body: 'Great news on the job front today, but we can do more...', status: 'published', platform: 'facebook', suggested_post_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), published_at: new Date(Date.now() - 50 * 60 * 1000).toISOString() }
  ]);
  if (draftErr) console.error('Drafts insert error:', draftErr.message);
  else console.log('Inserted 2 content drafts');

  // 5. Performance Metrics (upsert to avoid unique constraint on re-run)
  const todayStr = new Date().toISOString().split('T')[0];
  const { error: metricErr } = await supabase.from('performance_metrics').upsert([
    { tenant_id, metric_date: todayStr, platform: 'twitter', followers_change: 125, engagement_rate: 0.034 },
    { tenant_id, metric_date: todayStr, platform: 'facebook', followers_change: 42, engagement_rate: 0.051 }
  ], { onConflict: 'tenant_id,metric_date,platform' });
  if (metricErr) console.error('Metrics insert error:', metricErr.message);
  else console.log('Upserted 2 performance metrics');

  // 6. Agent Runs (snake_case names to match actual agent output)
  const { error: runErr } = await supabase.from('agent_runs').insert([
    { tenant_id, agent_name: 'competitor_monitor', run_type: 'scheduled', status: 'completed', started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), completed_at: new Date(Date.now() - 29 * 60 * 1000).toISOString(), items_processed: 15, tokens_input: 4500, api_cost: 0.0135 },
    { tenant_id, agent_name: 'news_pulse', run_type: 'scheduled', status: 'completed', started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), completed_at: new Date(Date.now() - 58 * 60 * 1000).toISOString(), items_processed: 42, tokens_input: 12000, api_cost: 0.036 },
    { tenant_id, agent_name: 'sentiment_analyzer', run_type: 'scheduled', status: 'completed', started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), completed_at: new Date(Date.now() - 118 * 60 * 1000).toISOString(), items_processed: 500, tokens_input: 25000, api_cost: 0.075 }
  ]);
  if (runErr) console.error('Agent runs insert error:', runErr.message);
  else console.log('Inserted 3 agent runs');

  console.log('\nSeeding complete.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
