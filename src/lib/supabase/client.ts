import { createClient } from '@supabase/supabase-js';

import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';

// Server-side client with service role (for agents and API routes)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Client-side client with anon key (for dashboard)
export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Default tenant for single-tenant mode
export const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || 'bottoms-2026';
