import { z } from 'zod';
import { uidSchema } from './common';

// ─── Create Project Schema ────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
    name: z
        .string()
        .min(2, 'Project name must be at least 2 characters')
        .max(100, 'Project name must be under 100 characters'),
    description: z
        .string()
        .max(1000, 'Description must be under 1000 characters')
        .optional()
        .default(''),
    teamId: uidSchema.or(z.literal('')).optional().default(''),
    ownerUid: uidSchema,
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
