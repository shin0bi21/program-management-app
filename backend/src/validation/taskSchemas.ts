import { z } from 'zod';
import { hoursCategorySchema } from './hoursSchemas';
import { cursorListFields } from './listQuerySchemas';
import { calendarDateSchema, DATE_RANGE_LIMIT_MESSAGE, exceedsDateRangeLimit } from './dateRangeValidation';

const nullableUuid = (message: string) => z.string().uuid(message).nullable().optional().transform(value => value ?? null);

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
    start: calendarDateSchema('Start date').optional(),
    end: calendarDateSchema('End date').optional(),
    ...cursorListFields(['firstName', 'lastName', 'title', 'category', 'program', 'startDate', 'dueDate', 'status'], 'startDate', 'asc'),
  }).refine(({ start, end }) => Boolean(start) === Boolean(end), {
    message: 'Start and end dates must be provided together',
    path: ['end'],
  }).refine(({ start, end }) => !start || !end || start <= end, {
    message: 'End date must be on or after start date',
    path: ['end'],
  }).refine(({ start, end }) => !exceedsDateRangeLimit(start, end), {
    message: DATE_RANGE_LIMIT_MESSAGE,
    path: ['end'],
  }),
});

export const taskCalendarQuerySchema = z.object({
  query: z.object({
    ...taskFilterFields,
    start: calendarDateSchema('Start date'),
    end: calendarDateSchema('End date'),
  }).refine(query => query.start <= query.end, {
    message: 'End date must be on or after start date',
    path: ['end'],
  }).refine(({ start, end }) => !exceedsDateRangeLimit(start, end), {
    message: DATE_RANGE_LIMIT_MESSAGE,
    path: ['end'],
  }),
});

export const setTaskSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title cannot exceed 255 characters'),
    details: z.string().trim().max(2000, 'Details cannot exceed 2000 characters').nullable().optional().transform(value => value || null),
    category: hoursCategorySchema,
    programId: nullableUuid('Invalid program ID'),
    startDate: calendarDateSchema('Start date'),
    dueDate: calendarDateSchema('Due date'),
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
    startDate: calendarDateSchema('Start date'),
    dueDate: calendarDateSchema('Due date'),
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
