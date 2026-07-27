import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Define protected and auth routes
    const isDashboardRoute = pathname.startsWith('/dashboard');
    const isAuthRoute = pathname.startsWith('/login');

    // Read the HttpOnly session cookie
    const sessionCookie = request.cookies.get('session');

    // Fast-path: no cookie at all → redirect to login immediately
    if (isDashboardRoute && !sessionCookie) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Already logged in → redirect away from /login
    if (isAuthRoute && sessionCookie) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

// Match dashboard and login routes only
export const config = {
    matcher: ['/dashboard/:path*', '/login'],
};