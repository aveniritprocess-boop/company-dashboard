import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from './firebase-admin';

export interface DecodedUser {
    uid: string;
    email?: string;
    role: string;
    name?: string;
    ip: string;
    browser: string;
    device: string;
    userAgent: string;
    correlationId?: string;
}

export function getClientInfo(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               '127.0.0.1';
               
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    
    // Parse device type from User-Agent
    let device = 'Desktop';
    if (/mobi|android|iphone|ipad|ipod/i.test(userAgent)) {
        device = 'Mobile/Tablet';
    }
    
    // Parse browser name from User-Agent
    let browser = 'Other';
    if (userAgent.includes('Firefox')) {
        browser = 'Firefox';
    } else if (userAgent.includes('Chrome') && !userAgent.includes('Chromium')) {
        browser = 'Chrome';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browser = 'Safari';
    } else if (userAgent.includes('Edge')) {
        browser = 'Edge';
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) {
        browser = 'IE';
    }
    
    return { ip, browser, device, userAgent };
}

export async function verifyFirebaseToken(request: NextRequest): Promise<DecodedUser | { error: string; status: number }> {
    const sessionCookie = request.cookies.get('session')?.value;
    const authHeader = request.headers.get('Authorization');
    
    let uid = '';
    let email = '';

    try {
        if (sessionCookie) {
            // Verify session cookie and check revocation
            const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
            uid = decodedClaims.uid;
            email = decodedClaims.email || '';
        } else if (authHeader?.startsWith('Bearer ')) {
            // Fallback for API backward compatibility
            const token = authHeader.split('Bearer ')[1];
            const decodedToken = await adminAuth.verifyIdToken(token);
            uid = decodedToken.uid;
            email = decodedToken.email || '';
        } else {
            return { error: 'Unauthorized: Missing token or session', status: 401 };
        }
        
        // Fetch user document from Firestore to check their status and portal access
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return { error: 'Unauthorized: Employee record not found', status: 401 };
        }
        
        const userData = userDoc.data() || {};
        
        // Reject immediately if deactivated, locked, soft-deleted, or portal access disabled
        if (userData.is_active === false || userData.portal_access === false || userData.is_locked === true || userData.is_deleted === true) {
            return { error: 'Unauthorized: Account is locked or portal access is disabled', status: 401 };
        }
        
        const clientInfo = getClientInfo(request);
        const correlationId = request.headers.get('x-correlation-id') || undefined;
        
        return {
            uid,
            email,
            role: userData.role || 'employee',
            name: userData.name || userData.displayName || '',
            correlationId,
            ...clientInfo
        };
    } catch (error: unknown) {
        console.error('Token/Session verification failed:', error);
        return { error: 'Unauthorized: Invalid token or session', status: 401 };
    }
}

export function authorizeRole(userRole: string, requiredRole: string): { error: string; status: number } | null {
    if (userRole.toLowerCase() !== requiredRole.toLowerCase()) {
        return { error: `Forbidden: Only ${requiredRole} can perform this action`, status: 403 };
    }
    return null;
}
