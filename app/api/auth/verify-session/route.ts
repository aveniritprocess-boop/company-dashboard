import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/auth-middleware';

/**
 * Internal session verification endpoint.
 * Called by middleware to validate the Firebase ID token stored in the session cookie.
 * Returns 200 OK if the token is valid and the account is active.
 * Returns 401 if the token is missing, expired, revoked, or the account is disabled.
 */
export async function GET(request: NextRequest) {
    // Read the token from the Authorization header (set by middleware)
    const user = await verifyFirebaseToken(request);
    if ('error' in user) {
        return NextResponse.json({ error: user.error }, { status: user.status });
    }
    return NextResponse.json({ uid: user.uid, role: user.role }, { status: 200 });
}
