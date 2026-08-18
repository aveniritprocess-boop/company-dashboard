import { z, ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

// ─── Shared Primitive Schemas ──────────────────────────────────────────────

/** Non-empty UID string */
export const uidSchema = z.string().min(1, 'UID is required');

/** Valid email address */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Optional mobile number.
 * Accepts 10-digit numbers (with optional +91 country prefix).
 * Passing empty string is allowed (treated as "not provided").
 */
export const phoneSchema = z
    .string()
    .optional()
    .refine(
        (val) => !val || /^(\+91[-\s]?)?[6-9]\d{9}$/.test(val.replace(/[\s-]/g, '')),
        { message: 'Invalid mobile number. Must be a 10-digit Indian mobile number.' }
    );

/** Password meeting modern strength requirements */
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((val) => /[A-Z]/.test(val), {
        message: 'Password must contain at least one uppercase letter',
    })
    .refine((val) => /[0-9]/.test(val), {
        message: 'Password must contain at least one number',
    });

// ─── Enum Schemas (Zod v4 compatible) ────────────────────────────────────

// Must stay in sync with UserRole in lib/roles.ts. 'md', 'agm' and 'team_lead'
// existed in UserRole/PERMISSIONS but were missing here, which meant the admin
// APIs rejected them outright — MD was effectively unassignable via the UI.
// NOTE: 'md' is CEO-tier in firestore.rules (isCEO() matches ceo OR md), so the
// CEO-only guard in update-employee/approve-change covers 'md' as well as
// 'ceo'/'admin' — otherwise making it assignable here would open a privilege
// escalation path.
export const roleSchema = z
    .enum(['ceo', 'md', 'agm', 'admin', 'hr', 'manager', 'team_lead', 'employee'])
    .refine(Boolean, { message: 'Role must be one of: ceo, md, agm, admin, hr, manager, team_lead, employee' });

export const genderSchema = z
    .enum(['male', 'female', 'non-binary', 'prefer-not-to-say'])
    .refine(Boolean, { message: 'Gender must be one of: male, female, non-binary, prefer-not-to-say' });

export const employeeStatusSchema = z
    .enum(['active', 'inactive', 'notice_period', 'archived'])
    .refine(Boolean, { message: 'Status must be one of: active, inactive, notice_period, archived' });

export const employeeTypeSchema = z
    .enum(['permanent', 'contract', 'intern', 'part_time'])
    .refine(Boolean, { message: 'Employee type must be one of: permanent, contract, intern, part_time' });

export const exitTypeSchema = z
    .enum(['resigned', 'terminated', 'retired', 'contract_ended'])
    .refine(Boolean, { message: 'Exit type must be one of: resigned, terminated, retired, contract_ended' });

export const taskStatusSchema = z
    .enum(['pending', 'in_progress', 'completed', 'approved', 'rejected', 'hold', 'backlog', 'todo', 'done', 'review'])
    .refine(Boolean, { message: 'Invalid task status' });

export const taskPrioritySchema = z
    .enum(['low', 'medium', 'high', 'critical'])
    .refine(Boolean, { message: 'Priority must be one of: low, medium, high, critical' });

// ─── Structured Error Response Helper ─────────────────────────────────────

interface ValidationSuccess<T> {
    data: T;
}

interface ValidationError {
    response: ReturnType<typeof NextResponse.json>;
}

/**
 * Validates data against a Zod schema.
 * Returns { data } on success.
 * Returns { response } containing a standardized 400 JSON response on failure.
 *
 * Usage:
 *   const result = parseOrError(MySchema, body);
 *   if ('response' in result) return result.response;
 *   const data = result.data; // fully typed
 */
export function parseOrError<T>(
    schema: ZodSchema<T>,
    data: unknown
): ValidationSuccess<T> | ValidationError {
    const result = schema.safeParse(data);

    if (!result.success) {
        // Zod v4 uses result.error.issues
        const details = result.error.issues.map((e) => ({
            field: e.path.join('.') || 'root',
            message: e.message,
        }));

        return {
            response: NextResponse.json(
                {
                    success: false,
                    error: 'Validation failed',
                    details,
                },
                { status: 400 }
            ),
        };
    }

    return { data: result.data };
}
