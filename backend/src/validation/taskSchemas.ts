import { z } from 'zod';
import { timeEntryCategorySchema } from './timeEntrySchemas';

const nullableUuid = (message: string) => z.string().uuid(message).nullable().optional().transform(value => value ?? null);
const calendarDate = (label: string) => z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must use YYYY-MM-DD`)
  .refine(value => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, `${label} must be a valid calendar date`);

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'completed', 'cancelled']);

export const taskParamsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid task ID') }),
});

export const taskQuerySchema = z.object({
  query: z.object({
    staffId: z.string().uuid('Invalid staff ID').optional(),
    category: timeEntryCategorySchema.optional(),
    includeClosed: z.union([z.enum(['true', 'false']), z.boolean()]).optional().transform(value => value === true || value === 'true'),
  }),
});

export const setTaskSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title cannot exceed 255 characters'),
    details: z.string().trim().max(2000, 'Details cannot exceed 2000 characters').nullable().optional().transform(value => value || null),
    category: timeEntryCategorySchema,
    programId: nullableUuid('Invalid program ID'),
    startDate: calendarDate('Start date'),
    dueDate: calendarDate('Due date'),
    staffId: z.string().uuid('Invalid staff ID'),
  }).refine(input => input.startDate <= input.dueDate, {
    path: ['dueDate'],
    message: 'Due date must be on or after start date',
  }),
});

export const updateTaskStatusSchema = z.object({
  body: z.object({ status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']) }),
});

export const updateTaskPlacementSchema = z.object({
  body: z.object({
    startDate: calendarDate('Start date'),
    dueDate: calendarDate('Due date'),
    staffId: z.string().uuid('Invalid staff ID').optional(),
  }).refine(input => input.startDate <= input.dueDate, {
    path: ['dueDate'],
    message: 'Due date must be on or after start date',
  }),
});

export type TaskQuery = z.infer<typeof taskQuerySchema.shape.query>;
export type SetTaskInput = z.infer<typeof setTaskSchema.shape.body>;
export type TaskPlacementInput = z.infer<typeof updateTaskPlacementSchema.shape.body>;
