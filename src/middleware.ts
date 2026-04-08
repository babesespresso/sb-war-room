import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Webhooks from external platforms should not be secured via session token
  if (
    pathname.startsWith('/api/webhooks/') || 
    pathname.startsWith('/api/ai/') ||
    pathname.startsWith('/api/slack') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/analytics/') ||
    pathname.startsWith('/api/persona/')
  ) {
    return NextResponse.next();
  }
  
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
