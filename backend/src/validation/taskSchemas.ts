import { z } from 'zod';
import { hoursCategorySchema } from './hoursSchemas';
import { cursorListFields } from './listQuerySchemas';

const nullableUuid = (message: string) => z.string().uuid(message).nullable().optional().transform(value => value ?? null);
const calendarDate = (label: string) => z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must use YYYY-MM-DD`)
  .refine(value => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, `${label} must be a valid calendar date`);

export const taskStateSchema = z.enum(['open', 'completed', 'cancelled']);
export const taskStatusSchema = z.enum(['upcoming', 'active', 'overdue', 'completed', 'cancelled']);

export const taskParamsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid task ID') }),
});

export const openTaskQuerySchema = z.object({
  query: z.object({
    staffId: z.string().uuid('Invalid staff ID').optional(),
  }),
});

const commaSeparated = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(value => (
  typeof value === 'string' && value ? value.split(',') : []
), z.array(schema));

const taskFilterFields = {
  staffIds: commaSeparated(z.string().uuid('Invalid staff ID')),
  programIds: commaSeparated(z.union([z.string().uuid('Invalid program ID'), z.literal('general')])),
  categories: commaSeparated(hoursCategorySchema),
  statuses: commaSeparated(taskStatusSchema),
  search: z.string().trim().max(120).optional().default(''),
};

export const taskListQuerySchema = z.object({
  query: z.object({
    ...taskFilterFields,
    ...cursorListFields(['firstName', 'lastName', 'title', 'category', 'program', 'startDate', 'dueDate', 'status'], 'startDate', 'asc'),
  }),
});

export const taskCalendarQuerySchema = z.object({
  query: z.object({
    ...taskFilterFields,
    start: calendarDate('Start date'),
    end: calendarDate('End date'),
  }).refine(query => query.start <= query.end, {
    message: 'End date must be on or after start date',
    path: ['end'],
  }),
});

export const setTaskSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title cannot exceed 255 characters'),
    details: z.string().trim().max(2000, 'Details cannot exceed 2000 characters').nullable().optional().transform(value => value || null),
    category: hoursCategorySchema,
    programId: nullableUuid('Invalid program ID'),
    startDate: calendarDate('Start date'),
    dueDate: calendarDate('Due date'),
    staffId: z.string().uuid('Invalid staff ID'),
  }).refine(input => input.startDate <= input.dueDate, {
    path: ['dueDate'],
    message: 'Due date must be on or after start date',
  }),
});

export const updateTaskStateSchema = z.object({
  body: z.object({ state: taskStateSchema }),
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

export type OpenTaskQuery = z.infer<typeof openTaskQuerySchema.shape.query>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema.shape.query>;
export type TaskCalendarQuery = z.infer<typeof taskCalendarQuerySchema.shape.query>;
export type SetTaskInput = z.infer<typeof setTaskSchema.shape.body>;
export type TaskPlacementInput = z.infer<typeof updateTaskPlacementSchema.shape.body>;
