import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logActivityServer } from '@/lib/audit-server';
import { UpdateEmployeeSchema } from '@/lib/validators/employee';
import { parseOrError } from '@/lib/validators/common';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify token and authorize CEO or Admin role
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        const rateLimit = checkRateLimit(user.uid);
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        if (user.role.toLowerCase() !== 'ceo' && user.role.toLowerCase() !== 'admin' && user.role.toLowerCase() !== 'hr') {
            return NextResponse.json({ error: 'Forbidden: Only CEO, Admin, or HR can edit profiles' }, { status: 403 });
        }

        // 2. Parse and validate body
        const body = await request.json();
        const validation = parseOrError(UpdateEmployeeSchema, body);
        if ('response' in validation) return validation.response;
        const { uid } = validation.data;

        // 3. Fetch current employee data for comparison
        const docRef = adminDb.collection('users').doc(uid);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        const oldData = docSnap.data() || {};

        // Prevent modification of CEO/Admin profiles by HR
        const isOldCEOOrAdmin = oldData.role?.toLowerCase() === 'ceo' || oldData.role?.toLowerCase() === 'admin';
        if (isOldCEOOrAdmin && user.role.toLowerCase() === 'hr') {
            return NextResponse.json({ error: 'Forbidden: HR cannot edit CEO or Admin profiles' }, { status: 403 });
        }

        // Prevent modification of CEO profiles by normal admins
        if (oldData.role?.toLowerCase() === 'ceo' && user.role.toLowerCase() !== 'ceo') {
            return NextResponse.json({ error: 'Forbidden: Only the CEO can edit CEO profiles' }, { status: 403 });
        }

        // Destructure validated fields
        const {
            name,
            mobile,
            role,
            reporting_manager_id,
            department,
            location,
            location_id,
            designation,
            joining_date,
            employee_type,
            address,
            emergency_contact,
            profile_photo,
            is_active,
            portal_access,
            is_locked,
            is_deleted,
            status,
            exit_details
        } = validation.data;

        const updatePayload: Record<string, unknown> = {
            updated_at: new Date()
        };

        const changes: string[] = [];

        const checkAndUpdate = (field: string, newValue: unknown) => {
            if (newValue !== undefined && newValue !== (oldData as Record<string, unknown>)[field]) {
                updatePayload[field] = newValue;
                changes.push(`${field}: "${String((oldData as Record<string, unknown>)[field] ?? '')}" -> "${String(newValue)}"`);
            }
        };

        checkAndUpdate('name', name);
        checkAndUpdate('mobile', mobile);
        checkAndUpdate('role', role);
        checkAndUpdate('reporting_manager_id', reporting_manager_id);
        checkAndUpdate('department', department);
        checkAndUpdate('location', location);
        checkAndUpdate('location_id', location_id);
        checkAndUpdate('designation', designation);
        checkAndUpdate('joining_date', joining_date);
        checkAndUpdate('employee_type', employee_type);
        checkAndUpdate('address', address);
        checkAndUpdate('profile_photo', profile_photo);
        checkAndUpdate('is_active', is_active);
        checkAndUpdate('portal_access', portal_access);
        checkAndUpdate('is_locked', is_locked);
        checkAndUpdate('is_deleted', is_deleted);
        checkAndUpdate('status', status);

        // Handle exit_details object updates
        if (exit_details !== undefined) {
            const oldExit = oldData.exit_details || {};
            const newExit = exit_details || {};
            if (
                newExit.exit_date !== oldExit.exit_date ||
                newExit.exit_type !== oldExit.exit_type ||
                newExit.reason !== oldExit.reason
            ) {
                updatePayload.exit_details = exit_details;
                changes.push(`exit_details: updated`);
            }
        }

        // Emergency contact object comparison
        if (emergency_contact !== undefined) {
            const oldEC = oldData.emergency_contact || {};
            if (
                emergency_contact.name !== oldEC.name ||
                emergency_contact.relationship !== oldEC.relationship ||
                emergency_contact.mobile !== oldEC.mobile
            ) {
                updatePayload.emergency_contact = emergency_contact;
                changes.push(`emergency_contact: updated`);
            }
        }

        // If no changes detected, skip write & return early
        if (Object.keys(updatePayload).length <= 1) {
            return NextResponse.json({
                success: true,
                message: 'No modifications made'
            });
        }

        // 4. Update Firebase Auth name if it changed
        if (name && name !== oldData.name) {
            await adminAuth.updateUser(uid, {
                displayName: name
            });
        }

        // 5. Revoke tokens if portal access is disabled, user is locked, or deactivated
        const accessRevoked = 
            (is_active === false && oldData.is_active !== false) ||
            (portal_access === false && oldData.portal_access !== false) ||
            (is_locked === true && oldData.is_locked !== true) ||
            (is_deleted === true && oldData.is_deleted !== true);

        if (accessRevoked) {
            try {
                await adminAuth.revokeRefreshTokens(uid);
            } catch (err) {
                console.error("Token revocation failed (probably user does not exist in auth):", err);
            }
        }

        // 6. Update Firestore
        await docRef.update(updatePayload);

        // 7. Write to Audit Logs
        const isStatusChanged = 
            (is_active !== undefined && is_active !== oldData.is_active) ||
            (portal_access !== undefined && portal_access !== oldData.portal_access) ||
            (is_locked !== undefined && is_locked !== oldData.is_locked);
            
        const isRoleChanged = role !== undefined && role !== oldData.role;
        const actionType = isRoleChanged ? "role_change" : "employee_updated";
        
        const metadata: Record<string, unknown> = {
            changes
        };
        
        if (isRoleChanged || isStatusChanged) {
            const before: Record<string, unknown> = {};
            const after: Record<string, unknown> = {};
            
            if (isRoleChanged) {
                before.role = oldData.role || "employee";
                after.role = updatePayload.role;
            }
            if (is_active !== undefined && is_active !== oldData.is_active) {
                before.is_active = oldData.is_active ?? true;
                after.is_active = is_active;
            }
            if (portal_access !== undefined && portal_access !== oldData.portal_access) {
                before.portal_access = oldData.portal_access ?? true;
                after.portal_access = portal_access;
            }
            if (is_locked !== undefined && is_locked !== oldData.is_locked) {
                before.is_locked = oldData.is_locked ?? false;
                after.is_locked = is_locked;
            }
            
            metadata.before = before;
            metadata.after = after;
        }

        await logActivityServer({
            action: actionType,
            performedBy: user.uid,
            performedByName: user.name || user.email || 'Admin',
            targetId: uid,
            targetType: "user",
            details: `Updated employee profile. Modifications: ${changes.join(', ')}`,
            correlationId: user.correlationId,
            metadata,
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
        });

        return NextResponse.json({
            success: true,
            message: 'Employee updated successfully'
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error updating employee:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
