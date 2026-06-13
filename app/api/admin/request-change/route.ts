import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
    try {
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        const body = await request.json();
        const { uid, changes, previous_values, reason } = body;

        if (!uid || !changes || !previous_values || !reason) {
            return NextResponse.json({ error: 'Missing required fields: uid, changes, previous_values, reason' }, { status: 400 });
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
        await adminDb.collection('audit_logs').add({
            operator_id: user.uid,
            operator_name: user.name || user.email || 'HR operator',
            action: 'update',
            target_id: uid,
            target_name: targetName,
            details: `Requested profile revision approval (Request ID: ${docRef.id}). Reason: ${reason}`,
            timestamp: new Date()
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
