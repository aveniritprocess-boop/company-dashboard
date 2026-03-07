import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Define protected routes
    const isDashboardRoute = pathname.startsWith('/dashboard');
    const isAuthRoute = pathname.startsWith('/login');

    // 2. Check for the session cookie
    // Note: We'll set this 'session' cookie in the login page upon successful Firebase auth
    const hasSession = request.cookies.has('session');

    // 3. Redirect logic
    if (isDashboardRoute && !hasSession) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthRoute && hasSession) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

// Config to match dashboard and login routes
export const config = {
    matcher: ['/dashboard/:path*', '/login'],
};
  