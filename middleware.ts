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

    // Forward the current pathname so server components (e.g. dashboard/layout.tsx)
    // can enforce the must_change_password redirect without a loop on the
    // update-password page itself.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-pathname', pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
}

// Match dashboard and login routes only
export const config = {
    matcher: ['/dashboard/:path*', '/login'],
};