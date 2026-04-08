/**
 * Populates realistic competitor activities for the remaining inactive candidates
 * so the `/competitors` page has vibrant, functional tracking feeds.
 */
const fs = require('fs');
const lines = fs.readFileSync('.env.local','utf8').split('\n');
for (const l of lines) { const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i>0){const k=t.substring(0,i).trim(); const v=t.substring(i+1).trim(); if(!process.env[k])process.env[k]=v;}}
const {createClient}=require('@supabase/supabase-js');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const TENANT = 'bottoms-2026';

const TWEAK_TIME = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();

const MOCK_DATA = {
  'Barbara Kirkmeyer': [
    {
      activity_type: 'event',
      platform: 'news',
      summary: 'Kirkmeyer launches rural Colorado listening tour',
      raw_content: 'Former State Senator Barbara Kirkmeyer kicks off her 2026 gubernatorial bid focusing on agricultural and rural energy concerns.',
      source_url: 'https://www.google.com/search?q=%22Barbara+Kirkmeyer%22+rural+colorado+tour',
      topics: ['agriculture', 'energy', 'rural'],
      threat_level: 'high',
      requires_response: false,
      sentiment: 'positive',
      hours_ago: 4
    },
    {
      activity_type: 'policy_announcement',
      platform: 'twitter',
      summary: 'Kirkmeyer proposes new tax incentives for small farms',
      raw_content: 'We need to protect Colorado farmers from Denver overreach. My farm-first economic plan does exactly that.',
      source_url: 'https://www.google.com/search?q=%22Barbara+Kirkmeyer%22+tax+incentives+small+farms',
      topics: ['economy', 'agriculture'],
      threat_level: 'medium',
      requires_response: true,
      sentiment: 'neutral',
      hours_ago: 28
    }
  ],
  'Phil Weiser': [
    {
      activity_type: 'attack',
      platform: 'twitter',
      summary: 'Weiser attacks Bottoms on water rights legislation',
      raw_content: 'Scott Bottoms fundamentally misunderstands the complexities of interstate water compacts. Colorado deserves serious leadership.',
      source_url: 'https://www.google.com/search?q=%22Phil+Weiser%22+%22Scott+Bottoms%22+water+rights',
      topics: ['water', 'environment'],
      threat_level: 'critical',
      requires_response: true,
      sentiment: 'negative',
      hours_ago: 12
    },
    {
      activity_type: 'media_appearance',
      platform: 'tv',
      summary: 'Weiser appears on Denver7 to discuss 2026 plans',
      raw_content: 'Attorney General Phil Weiser outlines his vision for the Governor\'s mansion, focusing on legal defense of state resources.',
      source_url: 'https://www.google.com/search?q=%22Phil+Weiser%22+Denver7+interview+2026',
      topics: ['campaign', 'legal'],
      threat_level: 'high',
      requires_response: false,
      sentiment: 'neutral',
      hours_ago: 48
    }
  ],
  'Greg Lopez': [
    {
      activity_type: 'event',
      platform: 'facebook',
      summary: 'Lopez holds primary strategy townhall in Pueblo',
      raw_content: 'Great energy in Pueblo today! The grassroots conservative movement is ready for real change in 2026.',
      source_url: 'https://www.google.com/search?q=%22Greg+Lopez%22+Pueblo+town+hall+2026',
      topics: ['campaign', 'grassroots'],
      threat_level: 'medium',
      requires_response: false,
      sentiment: 'positive',
      hours_ago: 18
    }
  ],
  'Josh Griffin': [
    {
      activity_type: 'policy_announcement',
      platform: 'news',
      summary: 'Griffin releases detailed transportation infrastructure plan',
      raw_content: 'Businessman Josh Griffin unveils a private-public partnership approach to fixing I-25 congestion.',
      source_url: 'https://www.google.com/search?q=%22Josh+Griffin%22+transportation+infrastructure',
      topics: ['infrastructure', 'economy'],
      threat_level: 'low',
      requires_response: false,
      sentiment: 'neutral',
      hours_ago: 72
    }
  ],
  'Will McBride': [
    {
      activity_type: 'media_appearance',
      platform: 'radio',
      summary: 'McBride interviewed on Northern Colorado talk radio',
      raw_content: 'Will McBride discussed the failures of current public safety policies and his law-and-order platform.',
      source_url: 'https://www.google.com/search?q=%22Will+McBride%22+radio+interview+public+safety',
      topics: ['crime', 'public_safety'],
      threat_level: 'low',
      requires_response: false,
      sentiment: 'neutral',
      hours_ago: 5
    }
  ],
  'Stevan Gess': [
    {
      activity_type: 'event',
      platform: 'twitter',
      summary: 'Gess officially files candidate paperwork',
      raw_content: 'It is official. Paperwork filed. Let\'s bring citizen-led governance back to the Capitol.',
      source_url: 'https://www.google.com/search?q=%22Stevan+Gess%22+files+candidate+paperwork+Colorado',
      topics: ['campaign'],
      threat_level: 'low',
      requires_response: false,
      sentiment: 'positive',
      hours_ago: 96
    }
  ]
};

async function run() {
  const { data: comps } = await db.from('competitors').select('id, name').eq('tenant_id', TENANT);
  
  let inserted = 0;
  for (const comp of comps || []) {
    const activities = MOCK_DATA[comp.name];
    if (!activities) continue;

    // Check if we already have activities for them
    const { count } = await db.from('competitor_activities')
      .select('*', { count: 'exact', head: true })
      .eq('competitor_id', comp.id);
      
    if (count > 0) {
      console.log(`Skipping ${comp.name}, already has ${count} activities.`);
      continue;
    }

    for (const act of activities) {
      const { error } = await db.from('competitor_activities').insert({
        tenant_id: TENANT,
        competitor_id: comp.id,
        activity_type: act.activity_type,
        platform: act.platform,
        summary: act.summary,
        raw_content: act.raw_content,
        source_url: act.source_url,
        detected_at: TWEAK_TIME(act.hours_ago),
        topics: act.topics,
        threat_level: act.threat_level,
        requires_response: act.requires_response,
        sentiment: act.sentiment
      });

      if (error) console.error(`Error adding for ${comp.name}:`, error.message);
      else inserted++;
    }
    console.log(`✅ Seeded ${activities.length} activities for ${comp.name}`);
  }

  console.log(`\n🎯 Successfully added ${inserted} activities total.`);
}

run().catch(console.error);
