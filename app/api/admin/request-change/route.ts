import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken, isHRLevel, isAdminLevel } from '@/lib/auth-middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logActivityServer } from '@/lib/audit-server';
import { RequestChangeSchema } from '@/lib/validators/auth';
import { parseOrError } from '@/lib/validators/common';

export async function POST(request: NextRequest) {
    try {
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        // Rate limit
        const rateLimit = checkRateLimit(user.uid);
        if (!rateLimit.allowed) {
            return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        const body = await request.json();
        const validation = parseOrError(RequestChangeSchema, body);
        if ('response' in validation) return validation.response;
        const { uid, changes, previous_values, reason } = validation.data;

        // Authorization check: non-HR/Admin users can ONLY request profile changes for their own UID
        const isElevated = isHRLevel(user.role) || isAdminLevel(user.role);
        if (!isElevated && uid !== user.uid) {
            return NextResponse.json({
                success: false,
                error: 'Forbidden: You can only submit profile change requests for your own account.'
            }, { status: 403 });
        }

        // Fetch target user name
        const targetDoc = await adminDb.collection('users').doc(uid).get();
        if (!targetDoc.exists) {
            return NextResponse.json({ error: 'Target employee not found' }, { status: 404 });
        }
        const targetName = targetDoc.data()?.name || 'Unknown';

        // Write request to change_approval_queue
        const docRef = await adminDb.collection('change_approval_queue').add({
            target_id: uid,
            target_name: targetName,
            requested_by: user.uid,
            requested_by_name: user.name || user.email || 'HR operator',
            changes,
            previous_values,
            reason,
            status: 'pending',
            timestamp: new Date()
        });

        // Add audit log for change request creation
        await logActivityServer({
            action: "employee_updated",
            performedBy: user.uid,
            performedByName: user.name || user.email || 'HR operator',
            targetId: uid,
            targetType: "user",
            details: `Requested profile revision approval (Request ID: ${docRef.id}). Reason: ${reason}`,
            correlationId: user.correlationId,
            metadata: {
                requestId: docRef.id,
                changes,
                before: previous_values,
                after: changes,
                reason
            },
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
        });

        return NextResponse.json({
            success: true,
            requestId: docRef.id,
            message: 'Change request submitted for authorization.'
        });

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        console.error('Error submitting change request:', err);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
