import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify token and authorize CEO, Admin, or HR role
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        if (user.role.toLowerCase() !== 'ceo' && user.role.toLowerCase() !== 'admin' && user.role.toLowerCase() !== 'hr') {
            return NextResponse.json({ error: 'Forbidden: Only CEO, Admin, or HR can send welcome emails' }, { status: 403 });
        }

        // 2. Parse target user ID
        const body = await request.json();
        const { uid } = body;

        if (!uid) {
            return NextResponse.json({ error: 'Missing required field: uid' }, { status: 400 });
        }

        // Fetch employee details
        const targetDoc = await adminDb.collection('users').doc(uid).get();
        if (!targetDoc.exists) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        const targetData = targetDoc.data() || {};
        const targetName = targetData.name || 'Unknown';

        // 3. Create Audit Log
        await adminDb.collection('audit_logs').add({
            operator_id: user.uid,
            operator_name: user.name || user.email || 'Admin',
            action: 'update',
            target_id: uid,
            target_name: targetName,
            details: `Sent welcome credentials email to ${targetName} (${targetData.email || 'N/A'}).`,
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent,
            timestamp: new Date()
        });

        return NextResponse.json({
            success: true,
            message: `Welcome credentials email successfully dispatched to ${targetData.email || 'employee'}`
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error sending welcome email:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
