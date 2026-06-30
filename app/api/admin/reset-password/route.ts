import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logActivityServer } from '@/lib/audit-server';
import { ResetPasswordSchema } from '@/lib/validators/auth';
import { parseOrError } from '@/lib/validators/common';

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
            return NextResponse.json({ error: 'Forbidden: Only CEO, Admin, or HR can reset passwords' }, { status: 403 });
        }

        // 2. Parse and validate target user ID and new password
        const body = await request.json();
        const validation = parseOrError(ResetPasswordSchema, body);
        if ('response' in validation) return validation.response;
        const { uid, password } = validation.data;

        // Fetch employee details for validation and audit trail
        const targetDoc = await adminDb.collection('users').doc(uid).get();
        if (!targetDoc.exists) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        const targetData = targetDoc.data() || {};
        const targetName = targetData.name || 'Unknown';

        // Security role restriction: only CEO/Admin can reset CEO/Admin passwords. HR cannot reset CEO or Admin passwords.
        const isTargetCEOOrAdmin = targetData.role?.toLowerCase() === 'ceo' || targetData.role?.toLowerCase() === 'admin';
        if (isTargetCEOOrAdmin && user.role.toLowerCase() === 'hr') {
            return NextResponse.json({ error: 'Forbidden: HR cannot reset passwords for CEO or Admin profiles' }, { status: 403 });
        }

        // Prevent resetting CEO password by Admins
        if (targetData.role?.toLowerCase() === 'ceo' && user.role.toLowerCase() !== 'ceo') {
            return NextResponse.json({ error: 'Forbidden: Only the CEO can reset CEO passwords' }, { status: 403 });
        }

        // 3. Update password in Firebase Auth
        await adminAuth.updateUser(uid, {
            password: password
        });

        // 4. Update must_change_password flag in Firestore and revoke current refresh tokens
        await adminDb.collection('users').doc(uid).update({
            must_change_password: true,
            updated_at: new Date()
        });

        try {
            await adminAuth.revokeRefreshTokens(uid);
        } catch (err) {
            console.error("Token revocation failed:", err);
        }

        // 5. Create Audit Log
        await logActivityServer({
            action: "settings_changed",
            performedBy: user.uid,
            performedByName: user.name || user.email || 'Admin',
            targetId: uid,
            targetType: "settings",
            severity: "warning",
            details: `Reset password for employee ${targetName} (${targetData?.employee_id || 'N/A'}). Session revoked, and password change forced on next login.`,
            correlationId: user.correlationId,
            metadata: {
                targetName,
                employee_id: targetData?.employee_id || 'N/A'
            },
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
        });

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully. User will be forced to change password on first login.'
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error resetting password:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
