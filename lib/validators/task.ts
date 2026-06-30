import { z } from 'zod';
import { uidSchema, taskStatusSchema, taskPrioritySchema } from './common';

// ─── Create Task Schema ───────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
    taskText: z
        .string()
        .min(3, 'Task title must be at least 3 characters')
        .max(500, 'Task title must be under 500 characters'),
    description: z.string().max(2000, 'Description must be under 2000 characters').optional().default(''),
    assignedTo: z.union([
        uidSchema,
        z.array(uidSchema).min(1, 'Assign to at least one user'),
    ]),
    assignedBy: uidSchema,
    priority: taskPrioritySchema.optional().default('medium'),
    status: taskStatusSchema.optional().default('pending'),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    mentionedUsers: z.array(z.string()).optional().default([]),
    attachments: z.array(z.object({
        name: z.string(),
        size: z.string(),
        url: z.string(),
    })).optional().default([]),
    teamId: z.string().optional().default(''),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

// ─── Update Task Schema ───────────────────────────────────────────────────

export const UpdateTaskSchema = z.object({
    taskId: uidSchema,
    taskText: z.string().min(3).max(500).optional(),
    description: z.string().max(2000).optional(),
    priority: taskPrioritySchema.optional(),
    status: taskStatusSchema.optional(),
    dueDate: z.string().optional(),
    progress: z.number().min(0).max(100).optional(),
}).refine(
    (data) => Object.keys(data).length > 1, // at least one field besides taskId
    { message: 'At least one field must be provided for update' }
);

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
