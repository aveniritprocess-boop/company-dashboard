import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken, isHRLevel } from '@/lib/auth-middleware';
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

        if (!isHRLevel(user.role)) {
            return NextResponse.json({ success: false, error: 'Forbidden: Only CEO, Admin, or HR can send welcome emails' }, { status: 403 });
        }

        // 2. Parse and validate target user ID
        const body = await request.json();
        const validation = parseOrError(UidBodySchema, body);
        if ('response' in validation) return validation.response;
        const { uid } = validation.data;

        // Fetch employee details
        const targetDoc = await adminDb.collection('users').doc(uid).get();
        if (!targetDoc.exists) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        const targetData = targetDoc.data() || {};
        const targetName = targetData.name || 'Unknown';

        // 3. Create Audit Log
        await logActivityServer({
            action: "settings_changed",
            performedBy: user.uid,
            performedByName: user.name || user.email || 'Admin',
            targetId: uid,
            targetType: "settings",
            details: `Sent welcome credentials email to ${targetName} (${targetData.email || 'N/A'}).`,
            correlationId: user.correlationId,
            metadata: {
                targetName,
                email: targetData.email || 'N/A'
            },
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
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
