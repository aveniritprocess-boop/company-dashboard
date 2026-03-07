import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        // 1. Verify that the requester is an Admin
        // For simplicity in this demo, we'll check the Authorization header for a token
        // In a real app, you'd verify the ID token and check the 'admin' role in custom claims or Firestore
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);

        // Check if user is admin in Firestore
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin access only' }, { status: 403 });
        }

        // 2. Parse common employee data
        const body = await request.json();
        const {
            email,
            password,
            name,
            mobile,
            role,
            reporting_manager_id,
            department,
            location,
            location_id,
            employee_id
        } = body;

        if (!email || !password || !name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 3. Create user in Firebase Auth
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName: name,
        });

        // 4. Store additional data in Firestore
        await adminDb.collection('users').doc(userRecord.uid).set({
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
            is_active: true,
            must_change_password: true, // Force password change on first login
            created_at: new Date(),
            updated_at: new Date(),
        });

        return NextResponse.json({
            success: true,
            uid: userRecord.uid,
            message: 'Employee account created successfully'
        });

    } catch (err: unknown) {
        const error = err as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error('Error creating employee:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
