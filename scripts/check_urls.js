const fs = require('fs');
const lines = fs.readFileSync('.env.local','utf8').split('\n');
for (const l of lines) { const t=l.trim(); if(!t||t.startsWith('#'))continue; const i=t.indexOf('='); if(i>0){const k=t.substring(0,i).trim(); const v=t.substring(i+1).trim(); if(!process.env[k])process.env[k]=v;}}
const {createClient}=require('@supabase/supabase-js');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async()=>{
  // Show all news with relevance >= 50
  const {data}=await db.from('news_items')
    .select('headline, summary, source_url, relevance_score')
    .eq('tenant_id','bottoms-2026')
    .gte('relevance_score', 50)
    .order('relevance_score', {ascending: false});

  console.log(`Articles with relevance >= 50: ${data?.length}\n`);
  for (const n of data || []) {
    const text = `${n.headline} ${n.summary||''}`.toLowerCase();
    // Check for competitor names
    const names = ['bennet', 'weiser', 'marx', 'kirkmeyer', 'lopez', 'oltmann', 'mikesell', 'bottoms'];
    const found = names.filter(nm => text.includes(nm));
    console.log(`[${n.relevance_score}] ${n.headline?.substring(0,80)}`);
    if (found.length) console.log(`  👤 Mentions: ${found.join(', ')}`);
    console.log(`  🔗 ${n.source_url?.substring(0,80)}`);
    console.log('');
  }
})()
