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
  const { data: acts } = await supabase.from('competitor_activities').select('id, summary, raw_content, source_url');
  console.log("Activities:\n");
  for (const act of acts) {
    console.log(`[ID] ${act.id}`);
    console.log(`[Summary] ${act.summary}`);
    console.log(`[URL] ${act.source_url}\n`);
  }
  
  const { data: news } = await supabase.from('news_items').select('id, headline, source_url').limit(50);
  console.log("News Items:\n");
  const badNews = news.filter(n => n.headline.toLowerCase().includes('bottom') || n.source_url.includes('bottom'));
  for (const n of badNews) {
    console.log(`[ID] ${n.id}  [Headline] ${n.headline} [URL] ${n.source_url}`);
  }
}
run();
