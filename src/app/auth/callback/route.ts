import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Can be ignored in edge cases where cookies are read-only
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Session established — redirect to login with a flag so the UI shows the password form
      const redirectUrl = requestUrl.origin + '/login?flow=invite';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Fallback: redirect to login on error or missing code
  const redirectUrl = requestUrl.origin + '/login';
  return NextResponse.redirect(redirectUrl);
}
