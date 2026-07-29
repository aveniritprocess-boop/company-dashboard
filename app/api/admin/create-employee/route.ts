import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logActivityServer } from '@/lib/audit-server';
import { CreateEmployeeSchema } from '@/lib/validators/employee';
import { parseOrError } from '@/lib/validators/common';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify token and authorize CEO/Admin/HR role
        const user = await verifyFirebaseToken(request);
        if ('error' in user) {
            return NextResponse.json({ error: user.error }, { status: user.status });
        }

        const rateLimit = checkRateLimit(user.uid);
        if (!rateLimit.allowed) {
            return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        if (user.role.toLowerCase() !== 'ceo' && user.role.toLowerCase() !== 'admin' && user.role.toLowerCase() !== 'hr') {
            return NextResponse.json({ success: false, error: 'Forbidden: Only CEO, Admin, or HR can create employees' }, { status: 403 });
        }

        // 2. Parse and validate body
        const body = await request.json();
        const validation = parseOrError(CreateEmployeeSchema, body);
        if ('response' in validation) return validation.response;
        const data = validation.data;

        const {
            email, password, name, mobile, role, reporting_manager_id, department,
            location, location_id, employee_id, is_active, portal_access, is_locked,
            designation, joining_date, employee_type, address, emergency_contact,
            profile_photo, gender, status
        } = data;

        // Security role restriction: only CEO can create/assign 'ceo' or 'admin' roles
        if ((role === 'ceo' || role === 'admin') && user.role.toLowerCase() !== 'ceo') {
            return NextResponse.json({ success: false, error: 'Forbidden: Only the CEO can create Admin or CEO accounts' }, { status: 403 });
        }

        // Check duplicate email and employee_id concurrently
        const [authCheck, emailSnap, idSnap] = await Promise.all([
            adminAuth.getUserByEmail(email).catch((err: { code?: string }) => {
                if (err.code !== 'auth/user-not-found') console.error("Auth check error:", err);
                return null;
            }),
            adminDb.collection('users').where('email', '==', email).limit(1).get(),
            employee_id ? adminDb.collection('users').where('employee_id', '==', employee_id).limit(1).get() : Promise.resolve({ empty: true })
        ]);

        if (authCheck) {
            return NextResponse.json({ success: false, error: 'Duplicate Email: A user account already exists with this email.' }, { status: 400 });
        }

        if (!emailSnap.empty) {
            return NextResponse.json({ success: false, error: 'Duplicate Email: An employee record already exists with this email.' }, { status: 400 });
        }

        if (!idSnap.empty) {
            return NextResponse.json({ success: false, error: `Duplicate Employee ID: An employee record already exists with ID "${employee_id}".` }, { status: 400 });
        }

        // 3. Create user in Firebase Auth
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: name,
        });

        // 4. Store additional data in Firestore
        const batch = adminDb.batch();
        const userRef = adminDb.collection('users').doc(userRecord.uid);
        const dirRef = adminDb.collection('employee_directory').doc(userRecord.uid);
        
        batch.set(userRef, {
            uid: userRecord.uid,
            name,
            email,
            mobile: mobile || "",
            role: role || "employee",
            reporting_manager_id: reporting_manager_id || "",
            department: department || "",
            location: location || "",
            location_id: location_id || "",
            employee_id: employee_id || "",
            is_active: is_active !== undefined ? is_active : true,
            portal_access: portal_access !== undefined ? portal_access : true,
            is_locked: is_locked !== undefined ? is_locked : false,
            is_deleted: false,
            must_change_password: true,
            designation: designation || "",
            joining_date: joining_date || new Date().toISOString().split('T')[0],
            employee_type: employee_type || "permanent",
            address: address || "",
            emergency_contact: emergency_contact || { name: "", relationship: "", mobile: "" },
            profile_photo: profile_photo || "",
            gender: gender || "prefer-not-to-say",
            status: status || "active",
            created_at: new Date(),
            updated_at: new Date(),
        });
        
        batch.set(dirRef, {
            uid: userRecord.uid,
            name,
            displayName: name,
            email,
            role: role || "employee",
            department: department || "",
            designation: designation || "",
            profile_photo: profile_photo || "",
            status: status || "active",
            is_active: is_active !== undefined ? is_active : true,
            portal_access: portal_access !== undefined ? portal_access : true,
        });
        
        await batch.commit();

        // 5. Create Audit Log
        await logActivityServer({
            action: "employee_created",
            performedBy: user.uid,
            performedByName: user.name || user.email || 'Admin',
            targetId: userRecord.uid,
            targetType: "user",
            details: `Onboarded employee ${name} (${employee_id || 'N/A'}) in department: ${department || 'N/A'}, designation: ${designation || 'N/A'}, role: ${role || 'employee'}.`,
            correlationId: user.correlationId,
            metadata: {
                name,
                email,
                role: role || 'employee',
                department: department || 'N/A',
                designation: designation || 'N/A',
                employee_id: employee_id || 'N/A'
            },
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
        });

        return NextResponse.json({
            success: true,
            uid: userRecord.uid,
            message: 'Employee account created successfully'
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error creating employee:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
