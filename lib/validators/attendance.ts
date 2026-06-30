import { z } from 'zod';
import { uidSchema } from './common';

// ─── Start Attendance Session Schema ─────────────────────────────────────

export const StartSessionSchema = z.object({
    userId: uidSchema,
    imageUrl: z.string().url('imageUrl must be a valid URL'),
});

export type StartSessionInput = z.infer<typeof StartSessionSchema>;

// ─── End Attendance Session Schema ───────────────────────────────────────

export const EndSessionSchema = z.object({
    userId: uidSchema,
    sessionId: z.string().min(1, 'sessionId is required'),
    imageUrl: z.string().url('imageUrl must be a valid URL'),
});

export type EndSessionInput = z.infer<typeof EndSessionSchema>;
