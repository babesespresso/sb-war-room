const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load .env.local manually
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runAuthMigration() {
  const adminEmail = 'admin@sb2026.com';
  const adminPassword = 'ReclaimColorado2026!';

  console.log(`Creating Admin user: ${adminEmail}`);
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: 'admin', name: 'War Room Admin' }
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('Admin user already exists.');
    } else {
      console.error('Failed to create admin user:', error.message);
    }
  } else {
    console.log(`Successfully created admin user: ${data.user.id}`);
  }
}

runAuthMigration();
