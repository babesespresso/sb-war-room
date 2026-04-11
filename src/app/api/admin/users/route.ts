import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Verify the caller is an admin
async function enforceAdminRole(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {} // Read-only context
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'admin') {
    return false;
  }
  return true;
}

// Get service role client (admin privs)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET(request: NextRequest) {
  const isAdmin = await enforceAdminRole(request);
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const adminClient = getAdminClient();
  const { data, error } = await adminClient.auth.admin.listUsers();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email,
    role: u.user_metadata?.role || 'user',
    created_at: u.created_at,
  }));

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const isAdmin = await enforceAdminRole(request);
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await request.json();
  const { email, role } = body;

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const adminClient = getAdminClient();
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { role: role === 'admin' ? 'admin' : 'user' },
    redirectTo: `${origin}/auth/callback`
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: data.user });
}

export async function DELETE(request: NextRequest) {
  const isAdmin = await enforceAdminRole(request);
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

  const adminClient = getAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
