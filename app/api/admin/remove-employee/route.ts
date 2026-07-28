import { NextRequest, NextResponse } from 'next/server';
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

        const rateLimit = checkRateLimit(user.uid);
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        if (user.role.toLowerCase() !== 'ceo' && user.role.toLowerCase() !== 'admin' && user.role.toLowerCase() !== 'hr') {
            return NextResponse.json({ error: 'Forbidden: Only CEO, Admin, or HR can archive employees' }, { status: 403 });
        }

        // 2. Parse and validate target user ID and exit details
        const body = await request.json();
        
        const uid = body.uid;
        if (!uid || typeof uid !== 'string') {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }
        
        const exitDate = body.exitDate;
        if (!exitDate || typeof exitDate !== 'string') {
            return NextResponse.json({ error: 'Exit Date is required' }, { status: 400 });
        }

        const exitType = body.exitType;
        if (!exitType || typeof exitType !== 'string') {
            return NextResponse.json({ error: 'Exit Type is required' }, { status: 400 });
        }

        const exitReason = body.exitReason || "";

        // Fetch employee details for validation and audit trail
        const targetDoc = await adminDb.collection('users').doc(uid).get();
        if (!targetDoc.exists) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        const targetData = targetDoc.data() || {};
        const targetName = targetData.name || 'Unknown';

        // Idempotency check: if already archived, return immediately
        if (targetData.status === "archived") {
            return NextResponse.json({
                success: true,
                alreadyArchived: true
            });
        }

        // Security role restriction: only CEO can remove/archive 'ceo' or 'admin' accounts
        if ((targetData.role?.toLowerCase() === 'ceo' || targetData.role?.toLowerCase() === 'admin') && user.role.toLowerCase() !== 'ceo') {
            return NextResponse.json({ error: 'Forbidden: Only the CEO can archive CEO or Admin accounts' }, { status: 403 });
        }

        // 3. Disable Firebase Authentication account and revoke active session tokens
        try {
            await adminAuth.updateUser(uid, { disabled: true });
            await adminAuth.revokeRefreshTokens(uid);
        } catch (err) {
            console.error("Auth account disable/token revocation failed:", err);
            // We continue even if auth fails, as the user might only exist in Firestore
        }

        // 4. Update status in Firestore to archived (Soft Delete) and store exit details
        const updateData: any = {
            is_deleted: true,
            is_active: false,
            portal_access: false,
            status: "archived",
            archived_at: new Date(),
            archived_by: user.uid,
            archived_by_name: user.name || user.email || 'Admin',
            updated_at: new Date(),
            exit_details: {
                exit_date: exitDate,
                exit_type: exitType,
                reason: exitReason
            }
        };

        await adminDb.collection('users').doc(uid).update(updateData);

        // 5. Create Audit Log
        await logActivityServer({
            action: "employee_deleted",
            performedBy: user.uid,
            performedByName: user.name || user.email || 'Admin',
            targetId: uid,
            targetType: "user",
            details: `Archived/Soft-deleted employee record for ${targetName} (${targetData?.employee_id || 'N/A'}). Exit Type: ${exitType}. Portal access revoked and account disabled.`,
            correlationId: user.correlationId,
            metadata: {
                targetName,
                employee_id: targetData?.employee_id || 'N/A',
                exit_type: exitType
            },
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
        });

        return NextResponse.json({
            success: true,
            message: 'Employee archived successfully'
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error archiving employee:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
