import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify token
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        // 2. Parse body fields
        const body = await request.json();
        const { action, target_id, target_name, details } = body;

        const allowedActions = ['login', 'logout', 'role_create', 'permission_change', 'update'];
        if (!action || !allowedActions.includes(action)) {
            return NextResponse.json({ error: 'Invalid or missing action field.' }, { status: 400 });
        }

        let finalDetails = details;
        if (!finalDetails) {
            if (action === 'login' || action === 'logout') {
                finalDetails = `Employee ${user.name || user.email} successfully logged ${action === 'login' ? 'in to' : 'out of'} the portal.`;
            } else {
                finalDetails = `Employee ${user.name || user.email} performed ${action} action.`;
            }
        }

        // 3. Write event to Audit Logs
        await adminDb.collection('audit_logs').add({
            operator_id: user.uid,
            operator_name: user.name || user.email || 'Employee',
            action: action,
            target_id: target_id || user.uid,
            target_name: target_name || user.name || user.email || 'Self',
            details: finalDetails,
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent,
            timestamp: new Date()
        });

        return NextResponse.json({
            success: true,
            message: `Event logged successfully`
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error logging auth event:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
