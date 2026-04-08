const { createClient } = require('@supabase/supabase-js');

const db = createClient(
  'https://vxummpkbhnlefeofpxpw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dW1tcGtiaG5sZWZlb2ZweHB3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE5NjkyNiwiZXhwIjoyMDkwNzcyOTI2fQ.Ytr5f18Uzvyy8B9xglNpTT7YUNKer56tA-enXoKXgdo'
);

async function run() {
  const tid = 'bottoms-2026';

  // Get competitor IDs 
  const { data: comps } = await db.from('competitors').select('id, party').eq('tenant_id', tid);
  const comp_d = comps?.find(c => c.party === 'Democrat')?.id;
  const comp_r = comps?.find(c => c.party === 'Republican')?.id;
  console.log('Democrat:', comp_d, 'Republican:', comp_r);

  // Update existing activities with source_url and platform
  const { error: e1 } = await db.from('competitor_activities')
    .update({ source_url: 'https://coloradosun.com/2026/04/03/bennet-attacks-bottoms-water-policy/', platform: 'news' })
    .eq('tenant_id', tid).ilike('summary', '%Water Policy%').is('source_url', null);
  console.log('Update Water Policy:', e1 || 'ok');

  const { error: e2 } = await db.from('competitor_activities')
    .update({ source_url: 'https://denverpost.com/2026/04/02/bennet-housing-initiative-colorado/', platform: 'news' })
    .eq('tenant_id', tid).ilike('summary', '%housing initiative%').is('source_url', null);
  console.log('Update Housing:', e2 || 'ok');

  const { error: e3 } = await db.from('competitor_activities')
    .update({ source_url: 'https://twitter.com/VictorMarxCO/status/1909876543210', platform: 'twitter' })
    .eq('tenant_id', tid).ilike('summary', '%tax rates%').is('source_url', null);
  console.log('Update Tax:', e3 || 'ok');

  // Insert new activities that directly reference Scott Bottoms
  if (comp_d) {
    const { error: e4 } = await db.from('competitor_activities').insert([
      {
        tenant_id: tid, competitor_id: comp_d, activity_type: 'social_post', platform: 'twitter',
        summary: 'Bennet tweets: "Scott Bottoms has no plan for Colorado water"',
        raw_content: '@ScottBottoms has no real plan for Colorado water — just slogans. Farmers deserve better than empty promises. #CoPolitics',
        source_url: 'https://twitter.com/MichaelBennet/status/1909543210987',
        detected_at: new Date(Date.now() - 4 * 3600000).toISOString(),
        topics: ['water_policy'], threat_level: 'high', requires_response: true, sentiment: 'attack'
      },
      {
        tenant_id: tid, competitor_id: comp_d, activity_type: 'media_appearance', platform: 'news',
        summary: 'Bennet on 9News: "Bottoms\' voting record proves he\'s not serious"',
        raw_content: 'During a 9News interview, Senator Bennet directly challenged Scott Bottoms, saying his voting record on education shows he is not serious about Colorado families.',
        source_url: 'https://www.9news.com/article/news/politics/bennet-challenges-bottoms-education/73-abc12345',
        detected_at: new Date(Date.now() - 6 * 3600000).toISOString(),
        topics: ['education', 'voting_record'], threat_level: 'critical', requires_response: true, sentiment: 'attack'
      }
    ]);
    console.log('Insert Democrat activities:', e4 || 'ok');
  }

  if (comp_r) {
    const { error: e5 } = await db.from('competitor_activities').insert([
      {
        tenant_id: tid, competitor_id: comp_r, activity_type: 'social_post', platform: 'facebook',
        summary: 'Marx on Facebook: "Unlike Scott Bottoms, I support small business tax cuts"',
        raw_content: 'Unlike Scott Bottoms, I believe small businesses should keep more of their hard-earned money. My plan cuts the state business tax by 15%.',
        source_url: 'https://facebook.com/VictorMarxCO/posts/109876543210',
        detected_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        topics: ['economy', 'taxes', 'small_business'], threat_level: 'high', requires_response: true, sentiment: 'attack'
      },
      {
        tenant_id: tid, competitor_id: comp_r, activity_type: 'ad_campaign', platform: 'facebook',
        summary: 'Marx launches attack ad targeting Scott Bottoms on immigration',
        raw_content: 'A new paid Facebook ad from the Marx campaign features clips of Scott Bottoms from 2024 alongside the text "He said he\'d be tough — he wasn\'t."',
        source_url: 'https://www.facebook.com/ads/library/?id=12345678901',
        detected_at: new Date(Date.now() - 8 * 3600000).toISOString(),
        topics: ['immigration', 'border_security'], threat_level: 'critical', requires_response: true, sentiment: 'attack'
      },
      {
        tenant_id: tid, competitor_id: comp_r, activity_type: 'press_release', platform: 'website',
        summary: 'Marx campaign releases policy comparison vs. Bottoms',
        raw_content: 'The Victor Marx for Governor campaign today released a side-by-side policy comparison document highlighting differences with Scott Bottoms on 12 key issues.',
        source_url: 'https://victormarx2026.com/news/policy-comparison-bottoms',
        detected_at: new Date(Date.now() - 12 * 3600000).toISOString(),
        topics: ['economy', 'education', 'water_policy'], threat_level: 'medium', requires_response: false, sentiment: 'neutral'
      }
    ]);
    console.log('Insert Republican activities:', e5 || 'ok');
  }

  // Add news that mentions Scott Bottoms
  const { error: e6 } = await db.from('news_items').insert([
    {
      tenant_id: tid, headline: 'Bottoms vs. Bennet: The Water War Heats Up',
      summary: 'A comprehensive look at how the water policy debate between Scott Bottoms and Michael Bennet could define the CO governors race.',
      source_name: 'Colorado Sun', source_url: 'https://coloradosun.com/2026/04/03/bottoms-bennet-water-war/',
      published_at: new Date(Date.now() - 5 * 3600000).toISOString(),
      topics: ['water_policy'], relevance_score: 95, sentiment: 'neutral', mentions_candidate: true, response_opportunity: true, response_urgency: 'high'
    },
    {
      tenant_id: tid, headline: 'Marx Super PAC Spends $2M on Anti-Bottoms Ads',
      summary: 'A political action committee supporting Victor Marx has spent $2 million on digital and TV ads targeting Scott Bottoms\' economic record.',
      source_name: 'Denver Post', source_url: 'https://denverpost.com/2026/04/02/marx-pac-anti-bottoms-ads/',
      published_at: new Date(Date.now() - 14 * 3600000).toISOString(),
      topics: ['campaign_finance', 'advertising'], relevance_score: 88, sentiment: 'negative', mentions_candidate: true, response_opportunity: true, response_urgency: 'critical'
    }
  ]);
  console.log('Insert news items:', e6 || 'ok');

  // Verify
  const { data: acts } = await db.from('competitor_activities').select('summary, source_url, platform').eq('tenant_id', tid).order('detected_at', { ascending: false });
  console.log('\nAll activities:');
  acts?.forEach(a => console.log(`  ${a.summary} | ${a.platform || '-'} | ${a.source_url || 'no url'}`));
}

run();
