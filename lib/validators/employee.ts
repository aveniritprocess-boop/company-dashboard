import { z } from 'zod';
import {
    uidSchema,
    emailSchema,
    phoneSchema,
    passwordSchema,
    roleSchema,
    genderSchema,
    employeeStatusSchema,
    employeeTypeSchema,
    exitTypeSchema,
} from './common';

// ─── Emergency Contact Sub-schema ─────────────────────────────────────────

const emergencyContactSchema = z.object({
    name: z.string().max(100, 'Contact name must be under 100 characters').optional().default(''),
    relationship: z.string().max(50, 'Relationship must be under 50 characters').optional().default(''),
    mobile: z.string().optional().default(''),
}).optional();

// ─── Exit Details Sub-schema ───────────────────────────────────────────────

const exitDetailsSchema = z.object({
    exit_date: z.string().optional(),
    exit_type: exitTypeSchema.optional(),
    reason: z.string().max(500, 'Exit reason must be under 500 characters').optional(),
}).optional();

// ─── Create Employee Schema ────────────────────────────────────────────────

export const CreateEmployeeSchema = z.object({
    // Required fields
    email: emailSchema,
    password: passwordSchema,
    name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be under 100 characters'),

    // Identity fields
    role: roleSchema.optional().default('employee'),
    gender: genderSchema.optional().default('prefer-not-to-say'),
    status: employeeStatusSchema.optional().default('active'),
    employee_type: employeeTypeSchema.optional().default('permanent'),

    // Contact
    mobile: phoneSchema,

    // Org fields
    reporting_manager_id: z.string().optional().default(''),
    department: z.string().max(100).optional().default(''),
    designation: z.string().max(100).optional().default(''),
    location: z.string().max(200).optional().default(''),
    location_id: z.string().optional().default(''),
    employee_id: z.string().max(50).optional(),

    // Access
    is_active: z.boolean().optional().default(true),
    portal_access: z.boolean().optional().default(true),
    is_locked: z.boolean().optional().default(false),

    // Dates
    joining_date: z
        .string()
        .optional()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
            message: 'joining_date must be a valid ISO date string',
        }),

    // Optional misc
    address: z.string().max(500).optional().default(''),
    profile_photo: z.string().url('Profile photo must be a valid URL').optional().or(z.literal('')),
    emergency_contact: emergencyContactSchema,
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

// ─── Update Employee Schema ────────────────────────────────────────────────
// All fields optional except uid

export const UpdateEmployeeSchema = z.object({
    uid: uidSchema,

    // Identity
    name: z.string().min(2).max(100).optional(),
    role: roleSchema.optional(),
    gender: genderSchema.optional(),
    status: employeeStatusSchema.optional(),
    employee_type: employeeTypeSchema.optional(),

    // Contact
    mobile: phoneSchema,

    // Org
    reporting_manager_id: z.string().optional(),
    department: z.string().max(100).optional(),
    designation: z.string().max(100).optional(),
    location: z.string().max(200).optional(),
    location_id: z.string().optional(),

    // Access
    is_active: z.boolean().optional(),
    portal_access: z.boolean().optional(),
    is_locked: z.boolean().optional(),
    is_deleted: z.boolean().optional(),

    // Dates
    joining_date: z
        .string()
        .optional()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
            message: 'joining_date must be a valid ISO date string',
        }),

    // Optional misc
    address: z.string().max(500).optional(),
    profile_photo: z.string().url('Profile photo must be a valid URL').optional().or(z.literal('')),
    emergency_contact: emergencyContactSchema,
    exit_details: exitDetailsSchema,
});

export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
