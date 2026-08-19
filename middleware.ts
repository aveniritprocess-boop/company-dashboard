import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Define protected and auth routes
    const isDashboardRoute = pathname.startsWith('/dashboard');

    // Read the HttpOnly session cookie
    const sessionCookie = request.cookies.get('session');

    // Fast-path: no cookie at all → redirect to login immediately.
    // NOTE: this is only a fast-path. The authoritative check is
    // verifySessionCookie(cookie, /* checkRevoked */ true) in
    // app/dashboard/layout.tsx, which still runs on every dashboard render.
    if (isDashboardRoute && !sessionCookie) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // FIX-1: the '/login' + cookie-exists → '/dashboard' redirect was removed.
    //
    // Middleware runs on the Edge runtime and cannot use the Firebase Admin SDK,
    // so it could only test that a session cookie EXISTED, never that it was
    // VALID. A revoked cookie (Firebase revokes tokens on every password change)
    // therefore produced an infinite loop: middleware sent /login → /dashboard
    // because the cookie was present, and the dashboard layout sent
    // /dashboard → /login because the cookie failed verification, with neither
    // side able to clear it. That surfaced in production as ERR_TOO_MANY_REDIRECTS.
    //
    // Dropping this convenience redirect makes the loop structurally impossible.
    // It removes no protection: /dashboard is still gated by the fast-path above
    // and by full server-side verification in the layout. An already-signed-in
    // user visiting /login is still forwarded to the dashboard by the client-side
    // onAuthStateChanged handler in app/(auth)/login/page.tsx.

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