import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify token and authorize CEO, Admin, or HR role
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        if (user.role.toLowerCase() !== 'ceo' && user.role.toLowerCase() !== 'admin' && user.role.toLowerCase() !== 'hr') {
            return NextResponse.json({ error: 'Forbidden: Only CEO, Admin, or HR can archive employees' }, { status: 403 });
        }

        // 2. Parse target user ID
        const body = await request.json();
        const { uid } = body;

        if (!uid) {
            return NextResponse.json({ error: 'Missing required field: uid' }, { status: 400 });
        }

        // Fetch employee details for validation and audit trail
        const targetDoc = await adminDb.collection('users').doc(uid).get();
        if (!targetDoc.exists) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        const targetData = targetDoc.data() || {};
        const targetName = targetData.name || 'Unknown';

        // Security role restriction: only CEO can remove/archive 'ceo' or 'admin' accounts
        if ((targetData.role?.toLowerCase() === 'ceo' || targetData.role?.toLowerCase() === 'admin') && user.role.toLowerCase() !== 'ceo') {
            return NextResponse.json({ error: 'Forbidden: Only the CEO can archive CEO or Admin accounts' }, { status: 403 });
        }

        // 3. Revoke active session tokens
        try {
            await adminAuth.revokeRefreshTokens(uid);
        } catch (err) {
            console.error("Token revocation failed:", err);
        }

        // 4. Update status in Firestore to archived (Soft Delete)
        await adminDb.collection('users').doc(uid).update({
            is_deleted: true,
            is_active: false,
            portal_access: false,
            status: "archived",
            archived_at: new Date(),
            archived_by: user.uid,
            archived_by_name: user.name || user.email || 'Admin',
            updated_at: new Date()
        });

        // 5. Create Audit Log
        await adminDb.collection('audit_logs').add({
            operator_id: user.uid,
            operator_name: user.name || user.email || 'Admin',
            action: 'delete',
            target_id: uid,
            target_name: targetName,
            details: `Archived/Soft-deleted employee record for ${targetName} (${targetData?.employee_id || 'N/A'}). Portal access revoked.`,
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent,
            timestamp: new Date()
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
