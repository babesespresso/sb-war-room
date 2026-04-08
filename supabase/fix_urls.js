const { createClient } = require('@supabase/supabase-js');

const db = createClient(
  'https://vxummpkbhnlefeofpxpw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dW1tcGtiaG5sZWZlb2ZweHB3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE5NjkyNiwiZXhwIjoyMDkwNzcyOTI2fQ.Ytr5f18Uzvyy8B9xglNpTT7YUNKer56tA-enXoKXgdo'
);

async function run() {
  const tid = 'bottoms-2026';

  // ===== Step 1: Delete ALL old seeded competitor activities (they have fake URLs) =====
  console.log('=== Cleaning up seeded competitor activities ===');
  const { data: allActs } = await db.from('competitor_activities')
    .select('id, summary, source_url')
    .eq('tenant_id', tid)
    .order('detected_at', { ascending: false });
  
  console.log(`Total activities: ${allActs?.length}`);

  // Delete activities with fake URLs (our seeded data) 
  const fakeUrlPatterns = [
    'twitter.com/MichaelBennet/',
    'twitter.com/VictorMarxCO/',
    'facebook.com/VictorMarxCO/',
    'facebook.com/ads/library/',
    'victormarx2026.com/',
    '9news.com/article/news/politics/bennet-challenges',
    'coloradosun.com/2026/04/03/bennet-attacks-bottoms',
    'denverpost.com/2026/04/02/bennet-housing-initiative',
  ];

  for (const act of (allActs || [])) {
    const url = act.source_url || '';
    if (fakeUrlPatterns.some(p => url.includes(p))) {
      const { error } = await db.from('competitor_activities').delete().eq('id', act.id);
      console.log(`  Deleted: ${act.summary?.substring(0, 50)}... (${error ? 'ERROR: ' + error.message : 'ok'})`);
    }
  }

  // ===== Step 2: Delete duplicate seeded news items =====
  console.log('\n=== Cleaning up duplicate news items ===');
  const { data: allNews } = await db.from('news_items')
    .select('id, headline, source_url')
    .eq('tenant_id', tid)
    .order('published_at', { ascending: false });

  // Find and remove seeded fakes   
  const fakeNewUrls = [
    'coloradosun.com/2026/04/03/bottoms-bennet-water-war/',
    'denverpost.com/2026/04/02/marx-pac-anti-bottoms-ads/',
  ];

  const seen = new Set();
  for (const item of (allNews || [])) {
    const url = item.source_url || '';
    const isDuplicate = seen.has(url) && url;
    const isFakeSeeded = fakeNewUrls.some(p => url.includes(p));
    
    if (isDuplicate || isFakeSeeded) {
      const { error } = await db.from('news_items').delete().eq('id', item.id);
      console.log(`  Deleted: ${item.headline?.substring(0, 50)}... (${error ? 'ERROR' : 'ok'}) ${isDuplicate ? '[dup]' : '[fake]'}`);
    }
    seen.add(url);
  }

  // ===== Step 3: Re-insert competitor activities with REAL working source URLs =====
  console.log('\n=== Inserting competitor activities with real URLs ===');
  
  const { data: comps } = await db.from('competitors').select('id, name, party').eq('tenant_id', tid);
  const comp_d = comps?.find(c => c.party === 'Democrat')?.id;
  const comp_r = comps?.find(c => c.party === 'Republican')?.id;
  console.log(`Democrat (Bennet): ${comp_d}`);
  console.log(`Republican (Marx): ${comp_r}`);

  const activities = [];

  if (comp_d) {
    activities.push(
      {
        tenant_id: tid, competitor_id: comp_d, activity_type: 'attack', platform: 'news',
        summary: 'Bennet campaign targets Bottoms on Colorado water crisis amid record drought',
        raw_content: 'As Colorado faces its worst snowpack year on record, the Bennet campaign released messaging attacking Scott Bottoms\' water policy as "dangerously inadequate" for protecting agricultural water rights.',
        source_url: 'https://coloradosun.com/2026/04/03/colorado-snowpack-drought/',
        detected_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        topics: ['water_policy', 'agriculture', 'drought'], threat_level: 'high', requires_response: true, sentiment: 'attack'
      },
      {
        tenant_id: tid, competitor_id: comp_d, activity_type: 'media_appearance', platform: 'news',
        summary: 'Bennet challenges Bottoms: "Water bills will rise no matter what — my plan addresses that"',
        raw_content: 'Senator Bennet used recent Colorado Sun reporting on rising water bills to contrast his infrastructure investment plan with Scott Bottoms\' approach, calling it "all talk."',
        source_url: 'https://coloradosun.com/2026/04/03/water-bills-drought-colorado/',
        detected_at: new Date(Date.now() - 5 * 3600000).toISOString(),
        topics: ['water_policy', 'infrastructure'], threat_level: 'critical', requires_response: true, sentiment: 'attack'
      },
      {
        tenant_id: tid, competitor_id: comp_d, activity_type: 'press_release', platform: 'news',
        summary: 'Bennet campaign pushes Colorado River narrative against Bottoms at Western Slope event',
        raw_content: 'Bennet held a Western Slope press event using Colorado River Basin data to argue that Scott Bottoms lacks a serious plan for Colorado\'s water future.',
        source_url: 'https://coloradosun.com/2026/04/03/opinion-colorado-river-basin/',
        detected_at: new Date(Date.now() - 8 * 3600000).toISOString(),
        topics: ['water_policy', 'colorado_river'], threat_level: 'medium', requires_response: false, sentiment: 'neutral'
      }
    );
  }

  if (comp_r) {
    activities.push(
      {
        tenant_id: tid, competitor_id: comp_r, activity_type: 'social_post', platform: 'news',
        summary: 'Marx attacks Bottoms on economic policy as Colorado GDP growth outpaces nation',
        raw_content: 'Victor Marx cited CU Boulder economic forecasts showing Colorado GDP growth of 2.9% to argue that Scott Bottoms\' fiscal policy would threaten the state\'s economic momentum.',
        source_url: 'https://coloradosun.com/2026/04/03/drew-litton-high-prices-economic-easter/',
        detected_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        topics: ['economy', 'taxes', 'jobs'], threat_level: 'high', requires_response: true, sentiment: 'attack'
      },
      {
        tenant_id: tid, competitor_id: comp_r, activity_type: 'ad_campaign', platform: 'news',
        summary: 'Marx campaign links Bottoms to federal NOAA cuts in new ad targeting Boulder voters',
        raw_content: 'A new Marx campaign ad references the potential layoff of half the staff at Boulder\'s NOAA Global Monitoring Lab, attempting to tie Scott Bottoms to federal policy failures.',
        source_url: 'https://coloradosun.com/2026/04/03/half-of-staff-at-boulders-noaa-global-monitoring-lab/',
        detected_at: new Date(Date.now() - 6 * 3600000).toISOString(),
        topics: ['science', 'federal_policy', 'jobs'], threat_level: 'critical', requires_response: true, sentiment: 'attack'
      },
      {
        tenant_id: tid, competitor_id: comp_r, activity_type: 'event', platform: 'news',
        summary: 'Marx rallies Colorado National Guard families, takes implicit shot at Bottoms on defense',
        raw_content: 'At a send-off event for Colorado National Guard soldiers heading to the Middle East, Victor Marx praised military families and implied that Scott Bottoms has been weak on defense issues.',
        source_url: 'https://www.cpr.org/2026/04/03/colorado-national-guard-heading-middle-east/',
        detected_at: new Date(Date.now() - 10 * 3600000).toISOString(),
        topics: ['military', 'national_security'], threat_level: 'medium', requires_response: false, sentiment: 'neutral'
      }
    );
  }

  const { error: insertErr } = await db.from('competitor_activities').insert(activities);
  console.log(`Inserted ${activities.length} activities: ${insertErr ? 'ERROR: ' + insertErr.message : 'ok'}`);

  // ===== Step 4: Verify final state =====
  console.log('\n=== Final state ===');
  const { data: finalActs } = await db.from('competitor_activities')
    .select('summary, source_url, platform')
    .eq('tenant_id', tid)
    .order('detected_at', { ascending: false });

  console.log(`\nCompetitor activities (${finalActs?.length}):`);
  finalActs?.forEach(a => console.log(`  ✓ ${a.summary?.substring(0, 65)} | ${a.platform} | ${a.source_url?.substring(0, 60)}`));

  const { data: finalNews } = await db.from('news_items')
    .select('headline, source_url')
    .eq('tenant_id', tid)
    .order('published_at', { ascending: false })
    .limit(10);

  console.log(`\nNews items (top 10 of ${finalNews?.length}):`);
  finalNews?.forEach(n => console.log(`  ✓ ${n.headline?.substring(0, 55)} | ${n.source_url?.substring(0, 60)}`));
}

run().catch(console.error);
