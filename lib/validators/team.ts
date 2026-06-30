import { z } from 'zod';
import { uidSchema } from './common';

// ─── Create Team Schema ───────────────────────────────────────────────────

export const CreateTeamSchema = z.object({
    name: z
        .string()
        .min(2, 'Team name must be at least 2 characters')
        .max(100, 'Team name must be under 100 characters'),
    ownerUid: uidSchema,
    ownerEmail: z.string().email('Owner email must be a valid email address').optional().default(''),
});

export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
