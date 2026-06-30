import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/auth-middleware';
import { logActivityServer } from '@/lib/audit-server';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify token
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        // 2. Parse body fields
        const body = await request.json();
        const { action, target_id, target_name, details, before, after } = body;

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

        // Map action to targetType
        let targetType: "user" | "settings" = "user";
        if (action === 'role_create' || action === 'permission_change') {
            targetType = "settings";
        }

        // 3. Write event to Audit Logs
        await logActivityServer({
            action: action, // login, logout, role_create, permission_change
            performedBy: user.uid,
            performedByName: user.name || user.email || 'Employee',
            targetId: target_id || user.uid,
            targetType,
            details: finalDetails,
            metadata: {
                targetName: target_name || 'Self',
                before: before || null,
                after: after || null
            },
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
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
