import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logActivityServer } from '@/lib/audit-server';
import { UidBodySchema } from '@/lib/validators/auth';
import { parseOrError } from '@/lib/validators/common';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify token and authorize CEO, Admin, or HR role
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        // Rate limit
        const rateLimit = checkRateLimit(user.uid);
        if (!rateLimit.allowed) {
            return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        if (user.role.toLowerCase() !== 'ceo' && user.role.toLowerCase() !== 'admin' && user.role.toLowerCase() !== 'hr') {
            return NextResponse.json({ success: false, error: 'Forbidden: Only CEO, Admin, or HR can restore archived employees' }, { status: 403 });
        }

        // 2. Parse and validate target user ID
        const body = await request.json();
        const validation = parseOrError(UidBodySchema, body);
        if ('response' in validation) return validation.response;
        const { uid } = validation.data;

        // Fetch employee details for validation and audit trail
        const targetDoc = await adminDb.collection('users').doc(uid).get();
        if (!targetDoc.exists) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        const targetData = targetDoc.data() || {};
        const targetName = targetData.name || 'Unknown';

        // Idempotency check: if already active, return immediately
        if (targetData.status === "active") {
            return NextResponse.json({
                success: true,
                alreadyActive: true
            });
        }

        // Security role restriction: only CEO can restore 'ceo' or 'admin' accounts
        const isTargetCEOOrAdmin = targetData.role?.toLowerCase() === 'ceo' || targetData.role?.toLowerCase() === 'admin';
        if (isTargetCEOOrAdmin && user.role.toLowerCase() === 'hr') {
            return NextResponse.json({ error: 'Forbidden: HR cannot restore CEO or Admin profiles' }, { status: 403 });
        }

        // 3. Re-enable Firebase Authentication account
        try {
            await adminAuth.updateUser(uid, { disabled: false });
        } catch (err) {
            console.error("Auth account enable failed:", err);
            // We continue even if auth fails, as the user might only exist in Firestore
        }

        // 4. Update status in Firestore to active (Restore) and clear exit details
        await adminDb.collection('users').doc(uid).update({
            is_deleted: false,
            is_active: true,
            portal_access: true,
            status: "active",
            archived_at: FieldValue.delete(),
            archived_by: FieldValue.delete(),
            archived_by_name: FieldValue.delete(),
            exit_details: FieldValue.delete(),
            updated_at: new Date()
        });

        // 5. Create Audit Log
        await logActivityServer({
            action: "employee_updated",
            performedBy: user.uid,
            performedByName: user.name || user.email || 'Admin',
            targetId: uid,
            targetType: "user",
            details: `Restored archived employee record for ${targetName} (${targetData?.employee_id || 'N/A'}). Reactivated, cleared exit details, and enabled auth account.`,
            correlationId: user.correlationId,
            metadata: {
                targetName,
                employee_id: targetData?.employee_id || 'N/A',
                before: { is_deleted: true, is_active: false, portal_access: false, status: "archived" },
                after: { is_deleted: false, is_active: true, portal_access: true, status: "active" }
            },
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
        });

        return NextResponse.json({
            success: true,
            message: 'Employee record restored successfully'
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error restoring employee:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
