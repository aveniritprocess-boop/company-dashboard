import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken, isHRLevel } from '@/lib/auth-middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logActivityServer } from '@/lib/audit-server';
import { UidBodySchema } from '@/lib/validators/auth';
import { parseOrError } from '@/lib/validators/common';
import { sendServerEmail } from '@/lib/email-server';
import { APP_URL } from '@/lib/config';

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
        const targetName = targetData.name || 'Employee';
        const targetEmail = targetData.email;

        if (!targetEmail || typeof targetEmail !== 'string') {
            return NextResponse.json({ success: false, error: 'Employee does not have a valid email address recorded.' }, { status: 400 });
        }

        // 3. Dispatch actual Welcome Email
        const emailResult = await sendServerEmail({
            to: targetEmail,
            subject: 'Welcome to Avenir Tech - Company Portal Credentials',
            text: `Hello ${targetName},\n\nWelcome to Avenir Tech! Your company portal account has been set up.\n\nEmployee ID: ${targetData.employee_id || 'N/A'}\nDepartment: ${targetData.department || 'N/A'}\n\nPlease access your account at: ${APP_URL}/login\n\nIf you have not set up your initial password, please use the "Forgot Password" or reset option on the login page.\n\nRegards,\nAvenir Tech HR & Admin Team`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded-radius: 12px;">
                    <h2 style="color: #4f46e5;">Welcome to Avenir Tech!</h2>
                    <p>Hello <strong>${targetName}</strong>,</p>
                    <p>Your company portal account has been officially set up and activated.</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Employee ID:</strong> ${targetData.employee_id || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Department:</strong> ${targetData.department || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Designation:</strong> ${targetData.designation || 'N/A'}</p>
                    </div>
                    <p>Please sign in to your dashboard to complete your profile setup:</p>
                    <p><a href="${APP_URL}/login" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Access Company Portal</a></p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                    <p style="font-size: 12px; color: #64748b;">If you need password assistance, please use the reset options on the login page or contact your HR administrator.</p>
                </div>
            `
        });

        if (!emailResult.success) {
            console.error("Failed to send welcome email:", emailResult.error);
            return NextResponse.json({
                success: false,
                error: emailResult.error || 'Failed to send welcome credentials email via mail service.'
            }, { status: 500 });
        }

        // 4. Create Audit Log
        await logActivityServer({
            action: "settings_changed",
            performedBy: user.uid,
            performedByName: user.name || user.email || 'Admin',
            targetId: uid,
            targetType: "settings",
            details: `Sent welcome credentials email to ${targetName} (${targetEmail}). Message ID: ${emailResult.messageId || 'N/A'}.`,
            correlationId: user.correlationId,
            metadata: {
                targetName,
                email: targetEmail,
                messageId: emailResult.messageId || null
            },
            ip: user.ip,
            browser: user.browser,
            device: user.device,
            userAgent: user.userAgent
        });

        return NextResponse.json({
            success: true,
            message: `Welcome credentials email successfully dispatched to ${targetEmail}`
        });

    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error sending welcome email:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}

