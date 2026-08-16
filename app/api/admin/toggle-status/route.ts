import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken, isHRLevelOrAbove, isCEOorMD } from '@/lib/auth-middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logActivityServer } from '@/lib/audit-server';
import { ToggleStatusSchema } from '@/lib/validators/auth';
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

        if (!isHRLevelOrAbove(user.role)) {
            return NextResponse.json({ error: 'Forbidden: Only CEO, Admin, or HR can manage user access' }, { status: 403 });
        }

        // 2. Parse and validate body fields
        const body = await request.json();
        const validation = parseOrError(ToggleStatusSchema, body);
        if ('response' in validation) return validation.response;
        const { uid, is_active, portal_access, is_locked } = validation.data;

        // 3. Fetch current employee data for validation and logging
        const docRef = adminDb.collection('users').doc(uid);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        const targetData = docSnap.data() || {};

        // Prevent modifying CEO/Admin accounts by HR
        const isTargetCEOOrAdmin = targetData.role?.toLowerCase() === 'ceo' || targetData.role?.toLowerCase() === 'admin';
        if (isTargetCEOOrAdmin && user.role.toLowerCase() === 'hr') {
            return NextResponse.json({ error: 'Forbidden: HR cannot alter CEO or Admin access status' }, { status: 403 });
        }

        // Prevent modifying CEO accounts by admins
        if (targetData.role?.toLowerCase() === 'ceo' && !isCEOorMD(user.role)) {
            return NextResponse.json({ error: 'Forbidden: Only the CEO can alter CEO access status' }, { status: 403 });
        }

        const updatePayload: Record<string, unknown> = {
            updated_at: new Date()
        };

        const changes: string[] = [];
        if (is_active !== undefined) {
            updatePayload.is_active = is_active;
            changes.push(`is_active -> ${is_active}`);
        }
        if (portal_access !== undefined) {
            updatePayload.portal_access = portal_access;
            changes.push(`portal_access -> ${portal_access}`);
        }
        if (is_locked !== undefined) {
            updatePayload.is_locked = is_locked;
            changes.push(`is_locked -> ${is_locked}`);
        }

        if (changes.length === 0) {
            return NextResponse.json({ error: 'No status changes provided' }, { status: 400 });
        }

        // 4. Update Firestore user status
        const batch = adminDb.batch();
        batch.update(docRef, updatePayload);
        
        const dirPayload: Record<string, unknown> = {};
        if (is_active !== undefined) dirPayload.is_active = is_active;
        if (portal_access !== undefined) dirPayload.portal_access = portal_access;
        if (is_locked !== undefined) dirPayload.is_locked = is_locked;
        // status is not strictly toggled here but is_active is what employee_directory cares about
        
        if (Object.keys(dirPayload).length > 0) {
            batch.update(adminDb.collection('employee_directory').doc(uid), dirPayload);
        }
        await batch.commit();

        // 5. If access is disabled, revoke refresh tokens
        const shouldRevoke = 
            (is_active === false) ||
            (portal_access === false) ||
            (is_locked === true);

        if (shouldRevoke) {
            try {
                await adminAuth.revokeRefreshTokens(uid);
            } catch (err) {
                console.error("Token revocation failed:", err);
            }
        }

        // 6. Write to Audit Logs
        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};
        if (is_active !== undefined) {
            before.is_active = targetData.is_active ?? true;
            after.is_active = is_active;
        }
        if (portal_access !== undefined) {
            before.portal_access = targetData.portal_access ?? true;
            after.portal_access = portal_access;
        }
        if (is_locked !== undefined) {
            before.is_locked = targetData.is_locked ?? false;
            after.is_locked = is_locked;
        }

        await logActivityServer({
            action: "employee_updated",
            performedBy: user.uid,
            performedByName: user.name || user.email || 'Admin',
            targetId: uid,
            targetType: "user",
            details: `Toggled access status parameters: ${changes.join(', ')}.`,
            correlationId: user.correlationId,
            metadata: {
                before,
                after,
                changes
            },
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
        });

        return NextResponse.json({
            success: true,
            message: `Account status updated successfully`
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error toggling employee status:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
