import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  // TODO: Authentication temporarily disabled for testing
  // Uncomment below to re-enable authentication

  // // Allow login page and API routes
  // if (
  //   request.nextUrl.pathname === '/login' ||
  //   request.nextUrl.pathname.startsWith('/api') ||
  //   request.nextUrl.pathname.startsWith('/_next')
  // ) {
  //   return NextResponse.next();
  // }

  // // Check for session token in cookies or headers
  // const token = request.cookies.get('session_token')?.value ||
  //   request.headers.get('authorization')?.replace('Bearer ', '');

  // // If no token and not on login page, redirect to login
  // if (!token && request.nextUrl.pathname !== '/login') {
  //   const loginUrl = new URL('/login', request.url);
  //   loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  //   return NextResponse.redirect(loginUrl);
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
