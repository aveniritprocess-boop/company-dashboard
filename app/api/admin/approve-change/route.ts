import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken, isCEOorMD } from '@/lib/auth-middleware';
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
        const userRef = adminDb.collection('users').doc(targetId);

        // Segregation of duties: the person who submitted a change request
        // cannot also be the one who approves it, even if they hold an
        // approval-capable role. Without this, a self-submitted request could
        // bypass the entire point of a review queue.
        if (requestData.requested_by === user.uid) {
            return NextResponse.json({ error: 'Forbidden: You cannot approve or reject your own change request' }, { status: 403 });
        }

        // Security role restriction: only CEO can approve a change that grants 'ceo' or 'admin'
        const requestedRole = requestData.changes?.role;
        if (action === 'approve' && (requestedRole === 'ceo' || requestedRole === 'admin') && !isCEOorMD(user.role)) {
            return NextResponse.json({ error: 'Forbidden: Only the CEO can approve a change that grants Admin or CEO role' }, { status: 403 });
        }

        if (action === 'approve') {
            // Transactional re-check-and-write: two concurrent approve/reject
            // calls for the same requestId could otherwise both pass the
            // status==='pending' check above before either commits, causing
            // the change to be double-applied. The transaction re-reads and
            // re-verifies status atomically immediately before writing, so a
            // second concurrent call fails cleanly instead of racing.
            try {
                await adminDb.runTransaction(async (tx) => {
                    const freshSnap = await tx.get(requestRef);
                    const freshData = freshSnap.data() || {};
                    if (!freshSnap.exists || freshData.status !== 'pending') {
                        throw new Error('ALREADY_PROCESSED');
                    }

                    tx.update(userRef, {
                        ...requestData.changes,
                        updated_at: new Date()
                    });

                    // Extract public fields for the directory update
                    const dirPayload: Record<string, unknown> = {};
                    const publicFields = ['name', 'displayName', 'email', 'role', 'department', 'designation', 'profile_photo', 'status', 'is_active', 'portal_access'];
                    for (const field of publicFields) {
                        if (requestData.changes[field] !== undefined) {
                            dirPayload[field] = requestData.changes[field];
                            // Also update displayName if name is changed
                            if (field === 'name') dirPayload.displayName = requestData.changes[field];
                        }
                    }

                    if (Object.keys(dirPayload).length > 0) {
                        tx.set(adminDb.collection('employee_directory').doc(targetId), dirPayload, { merge: true });
                    }

                    tx.update(requestRef, {
                        status: 'approved',
                        reviewed_by: user.uid,
                        review_note: review_note || '',
                        updated_at: new Date()
                    });
                });
            } catch (txErr: unknown) {
                if (txErr instanceof Error && txErr.message === 'ALREADY_PROCESSED') {
                    return NextResponse.json({ error: 'Request is already processed' }, { status: 409 });
                }
                throw txErr;
            }

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
            // Same transactional re-check as the approve path — prevents a
            // concurrent approve/reject race on the same request.
            try {
                await adminDb.runTransaction(async (tx) => {
                    const freshSnap = await tx.get(requestRef);
                    const freshData = freshSnap.data() || {};
                    if (!freshSnap.exists || freshData.status !== 'pending') {
                        throw new Error('ALREADY_PROCESSED');
                    }
                    tx.update(requestRef, {
                        status: 'rejected',
                        reviewed_by: user.uid,
                        review_note: review_note || '',
                        updated_at: new Date()
                    });
                });
            } catch (txErr: unknown) {
                if (txErr instanceof Error && txErr.message === 'ALREADY_PROCESSED') {
                    return NextResponse.json({ error: 'Request is already processed' }, { status: 409 });
                }
                throw txErr;
            }

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
