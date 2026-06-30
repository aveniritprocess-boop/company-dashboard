import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logActivityServer } from '@/lib/audit-server';
import { ApproveChangeSchema } from '@/lib/validators/auth';
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

        // Only CEO or Admin can approve change requests
        if (user.role.toLowerCase() !== 'ceo' && user.role.toLowerCase() !== 'admin') {
            return NextResponse.json({ success: false, error: 'Forbidden: Only CEO or Admin can approve profile changes' }, { status: 403 });
        }

        const body = await request.json();
        const validation = parseOrError(ApproveChangeSchema, body);
        if ('response' in validation) return validation.response;
        const { requestId, action, review_note } = validation.data;

        const requestRef = adminDb.collection('change_approval_queue').doc(requestId);
        const requestSnap = await requestRef.get();
        if (!requestSnap.exists) {
            return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
        }

        const requestData = requestSnap.data() || {};
        if (requestData.status !== 'pending') {
            return NextResponse.json({ error: 'Request is already processed' }, { status: 400 });
        }

        const targetId = requestData.target_id;
        const targetName = requestData.target_name;

        if (action === 'approve') {
            // Apply changes to target user in Firestore
            await adminDb.collection('users').doc(targetId).update({
                ...requestData.changes,
                updated_at: new Date()
            });

            // Update queue document
            await requestRef.update({
                status: 'approved',
                reviewed_by: user.uid,
                review_note: review_note || '',
                updated_at: new Date()
            });

            // Format details message
            const diffKeys = Object.keys(requestData.changes || {});
            const detailsStr = diffKeys.map(k => `[${k}] was modified from "${requestData.previous_values?.[k] || 'N/A'}" to "${requestData.changes?.[k] || 'N/A'}"`).join(', ');

            // Create Audit Log
            await logActivityServer({
                action: "employee_updated",
                performedBy: user.uid,
                performedByName: user.name || user.email || 'Admin',
                targetId: targetId,
                targetType: "user",
                details: `Approved profile changes for ${targetName}. Modifications applied: ${detailsStr}. Note: ${review_note || 'None'}`,
                correlationId: user.correlationId,
                metadata: {
                    requestId,
                    before: requestData.previous_values || {},
                    after: requestData.changes || {},
                    review_note: review_note || 'None',
                    detailsStr
                },
                ip: user.ip,
                browser: user.browser,
                device: user.device,
                userAgent: user.userAgent
            });

            return NextResponse.json({
                success: true,
                message: 'Change request approved and profile updated successfully.'
            });

        } else if (action === 'reject') {
            // Update queue document
            await requestRef.update({
                status: 'rejected',
                reviewed_by: user.uid,
                review_note: review_note || '',
                updated_at: new Date()
            });

            // Create Audit Log
            await logActivityServer({
                action: "employee_updated",
                performedBy: user.uid,
                performedByName: user.name || user.email || 'Admin',
                targetId: targetId,
                targetType: "user",
                details: `Rejected profile changes for ${targetName}. Note: ${review_note || 'None'}`,
                correlationId: user.correlationId,
                metadata: {
                    requestId,
                    review_note: review_note || 'None',
                    rejected: true
                },
                ip: user.ip,
                browser: user.browser,
                device: user.device,
                userAgent: user.userAgent
            });

            return NextResponse.json({
                success: true,
                message: 'Change request rejected successfully.'
            });
        } else {
            return NextResponse.json({ error: 'Invalid action. Must be approve or reject' }, { status: 400 });
        }

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Internal server error';
        console.error('Error processing change approval:', err);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
