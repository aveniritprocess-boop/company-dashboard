import { NextRequest, NextResponse } from "next/server";

/**
 * Clears a stale/invalid session cookie and sends the user to /login.
 *
 * Why this route exists (FIX-2):
 * app/dashboard/layout.tsx is a Server Component. When
 * verifySessionCookie(cookie, true) rejects a revoked or expired cookie, that
 * layout cannot delete the cookie — Next.js forbids mutating cookies during a
 * Server Component render. A previous attempt to call cookies().delete() there
 * crashed production and was reverted in commit f71ecda, which left the invalid
 * cookie in the browser indefinitely and produced a redirect loop.
 *
 * A Route Handler may set cookies, so the layout redirects here instead. This
 * route removes the dead cookie and forwards to /login, breaking the loop and
 * leaving the browser in a clean, signed-out state.
 *
 * Deliberately does NOT call adminAuth.revokeRefreshTokens(): the cookie is
 * already invalid, and revoking here would additionally sign the user out of
 * every other device — the opposite of the recovery behaviour we want. Global
 * revocation remains the job of /api/auth/logout.
 *
 * Safe to reach unauthenticated: it only ever deletes a cookie. It grants no
 * access and reveals nothing about whether a session existed.
 */
function clearSessionAndRedirect(request: NextRequest): NextResponse {
    const response = NextResponse.redirect(new URL("/login", request.url));

    // Same attributes as the cookie set in /api/auth/session, so the browser
    // reliably matches and removes it. maxAge: 0 expires it immediately.
    response.cookies.set("session", "", {
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
    });

    return response;
}

export async function GET(request: NextRequest) {
    return clearSessionAndRedirect(request);
}

export async function POST(request: NextRequest) {
    return clearSessionAndRedirect(request);
}
