import { z } from 'zod';
import { uidSchema, passwordSchema } from './common';

// ─── Reset Password Schema ────────────────────────────────────────────────

export const ResetPasswordSchema = z.object({
    uid: uidSchema,
    password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ─── Toggle Status Schema ─────────────────────────────────────────────────

export const ToggleStatusSchema = z
    .object({
        uid: uidSchema,
        is_active: z.boolean().optional(),
        portal_access: z.boolean().optional(),
        is_locked: z.boolean().optional(),
    })
    .refine(
        (data) =>
            data.is_active !== undefined ||
            data.portal_access !== undefined ||
            data.is_locked !== undefined,
        {
            message: 'At least one of is_active, portal_access, or is_locked must be provided',
        }
    );

export type ToggleStatusInput = z.infer<typeof ToggleStatusSchema>;

// ─── Approve/Reject Change Schema ────────────────────────────────────────

export const ApproveChangeSchema = z.object({
    requestId: z.string().min(1, 'requestId is required'),
    action: z.enum(['approve', 'reject']).refine(Boolean, { message: "action must be 'approve' or 'reject'" }),
    review_note: z.string().max(500, 'Review note must be under 500 characters').optional().default(''),
});

export type ApproveChangeInput = z.infer<typeof ApproveChangeSchema>;

// ─── Request Change Schema ────────────────────────────────────────────────

export const RequestChangeSchema = z.object({
    uid: uidSchema,
    changes: z.record(z.string(), z.unknown()).refine(
        (obj) => Object.keys(obj).length > 0,
        { message: 'changes object must not be empty' }
    ),
    previous_values: z.record(z.string(), z.unknown()),
    reason: z
        .string()
        .min(5, 'Reason must be at least 5 characters')
        .max(500, 'Reason must be under 500 characters'),
});

export type RequestChangeInput = z.infer<typeof RequestChangeSchema>;

// ─── Single UID Schema ────────────────────────────────────────────────────

/** For routes that accept only a uid: remove-employee, restore-employee, send-welcome */
export const UidBodySchema = z.object({
    uid: uidSchema,
});

export type UidBodyInput = z.infer<typeof UidBodySchema>;
