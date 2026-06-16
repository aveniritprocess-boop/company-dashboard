import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';
import { checkRateLimit } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify token and authorize CEO, Admin, or HR role
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        const rateLimit = checkRateLimit(user.uid);
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        if (user.role.toLowerCase() !== 'ceo' && user.role.toLowerCase() !== 'admin' && user.role.toLowerCase() !== 'hr') {
            return NextResponse.json({ error: 'Forbidden: Only CEO, Admin, or HR can manage user access' }, { status: 403 });
        }

        // 2. Parse body fields
        const body = await request.json();
        const { uid, is_active, portal_access, is_locked } = body;

        if (!uid) {
            return NextResponse.json({ error: 'Missing required field: uid' }, { status: 400 });
        }

        // 3. Fetch current employee data for validation and logging
        const docRef = adminDb.collection('users').doc(uid);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        const targetData = docSnap.data() || {};

        // Prevent modifying CEO/Admin accounts by HR
        const isTargetCEOOrAdmin = targetData.role?.toLowerCase() === 'ceo' || targetData.role?.toLowerCase() === 'admin';
        if (isTargetCEOOrAdmin && user.role.toLowerCase() === 'hr') {
            return NextResponse.json({ error: 'Forbidden: HR cannot alter CEO or Admin access status' }, { status: 403 });
        }

        // Prevent modifying CEO accounts by admins
        if (targetData.role?.toLowerCase() === 'ceo' && user.role.toLowerCase() !== 'ceo') {
            return NextResponse.json({ error: 'Forbidden: Only the CEO can alter CEO access status' }, { status: 403 });
        }

        const updatePayload: Record<string, unknown> = {
            updated_at: new Date()
        };

        const changes: string[] = [];
        if (is_active !== undefined) {
            updatePayload.is_active = is_active;
            changes.push(`is_active -> ${is_active}`);
        }
        if (portal_access !== undefined) {
            updatePayload.portal_access = portal_access;
            changes.push(`portal_access -> ${portal_access}`);
        }
        if (is_locked !== undefined) {
            updatePayload.is_locked = is_locked;
            changes.push(`is_locked -> ${is_locked}`);
        }

        if (changes.length === 0) {
            return NextResponse.json({ error: 'No status changes provided' }, { status: 400 });
        }

        // 4. Update Firestore user status
        await docRef.update(updatePayload);

        // 5. If access is disabled, revoke refresh tokens
        const shouldRevoke = 
            (is_active === false) ||
            (portal_access === false) ||
            (is_locked === true);

        if (shouldRevoke) {
            try {
                await adminAuth.revokeRefreshTokens(uid);
            } catch (err) {
                console.error("Token revocation failed:", err);
            }
        }

        // 6. Write to Audit Logs
        await adminDb.collection('audit_logs').add({
            operator_id: user.uid,
            operator_name: user.name || user.email || 'Admin',
            action: 'toggle_status',
            target_id: uid,
            target_name: targetData.name || 'Unknown',
            details: `Toggled access status parameters: ${changes.join(', ')}.`,
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent,
            timestamp: new Date()
        });

        return NextResponse.json({
            success: true,
            message: `Account status updated successfully`
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error toggling employee status:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
