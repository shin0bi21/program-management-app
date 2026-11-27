import { z } from 'zod';
import type { Hours } from '../services/staff/hours/hoursRowQuery';
import { cursorListFields } from './listQuerySchemas';
import { calendarDateSchema, hasOrderedCalendarBounds, hasPairedCalendarBounds } from './dateRangeValidation';

export const hoursCategorySchema = z.enum([
  'program_delivery',
  'planning_prep',
  'meeting',
  'administration',
  'outreach',
  'maintenance',
  'other',
] satisfies Hours['category'][]);

const hoursTypeSchema = z.enum(['regular', 'task', 'session'] satisfies Hours['type'][]);
const dateSchema = calendarDateSchema();

const hoursId = z.string().uuid('Invalid time entry ID');
export const hoursParamsSchema = z.object({
  params: z.object({ id: hoursId }),
});

/**
 * Parses a comma-separated query value as validated selections; omission selects nothing.
 * @param schema - Validation applied to each supplied selection.
 * @example commaSeparated(z.string().uuid()) // accepts a comma-separated list of UUIDs
 */
const commaSeparated = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(value => (
  typeof value === 'string' && value ? value.split(',') : []
), z.array(schema));

const hoursFilterFields = {
  staffIds: commaSeparated(z.string().uuid('Invalid staff ID')),
  categories: commaSeparated(hoursCategorySchema),
  programIds: commaSeparated(z.union([z.string().uuid('Invalid program ID'), z.literal('general')])),
  types: commaSeparated(hoursTypeSchema),
  cycleIds: commaSeparated(z.string().uuid('Invalid cycle ID')),
  search: z.string().trim().max(120).optional().default(''),
};

export const hoursCalendarQuerySchema = z.object({
  query: z.object({
    ...hoursFilterFields,
    start: dateSchema.optional(),
    end: dateSchema.optional(),
  }).refine(hasPairedCalendarBounds, {
    message: 'Start and end dates must be provided together',
    path: ['end'],
  }).refine(hasOrderedCalendarBounds, {
    message: 'Start date must be on or before end date',
    path: ['end'],
  }),
});

export const hoursTableQuerySchema = z.object({
  query: z.object({
    ...hoursFilterFields,
    start: dateSchema.optional(),
    end: dateSchema.optional(),
    ...cursorListFields(['firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'hours', 'note', 'type'], 'date', 'desc'),
  }).refine(hasPairedCalendarBounds, {
    message: 'Start and end dates must be provided together',
    path: ['end'],
  }).refine(hasOrderedCalendarBounds, {
    message: 'Start date must be on or before end date',
    path: ['end'],
  }),
});

export const hoursSessionQuerySchema = z.object({
  query: z.object({
    staffId: z.string().uuid('Invalid staff ID'),
    date: dateSchema,
  }),
});

export const hoursCycleSummaryQuerySchema = z.object({
  query: z.object({
    staffId: z.string().uuid('Invalid staff ID'),
    cycleId: z.string().uuid('Invalid cycle ID'),
  }),
});

export const hoursPayPeriodQuerySchema = z.object({
  query: z.object({
    staffId: z.string().uuid('Invalid staff ID'),
    date: dateSchema.optional(),
  }),
});

const hoursFields = z.strictObject({
  staffId: z.string().uuid('Invalid staff ID'),
  hours: z.number().positive('Hours must be greater than zero').max(24, 'Hours cannot exceed 24'),
  note: z.string(),
  type: hoursTypeSchema,
  date: dateSchema,
  programId: z.string().uuid('Invalid program ID').nullable(),
  category: hoursCategorySchema.exclude(['program_delivery']),
  taskId: z.string().uuid('Invalid task ID'),
  sessionId: z.string().uuid('Invalid session ID'),
});

const submittedHoursNote = z.string().trim().min(1, 'Note is required').max(2000, 'Note cannot exceed 2000 characters');
const sharedHoursFields = hoursFields.pick({ staffId: true, hours: true, note: true });

const regularHours = sharedHoursFields.extend({
  type: z.literal('regular'),
  date: hoursFields.shape.date,
  programId: hoursFields.shape.programId.default(null),
  category: hoursFields.shape.category,
});
const taskHours = sharedHoursFields.extend({
  type: z.literal('task'),
  date: hoursFields.shape.date,
  taskId: hoursFields.shape.taskId,
});
const sessionHours = sharedHoursFields.extend({
  type: z.literal('session'),
  sessionId: hoursFields.shape.sessionId,
});

export const hoursRecordSchema = z.discriminatedUnion('type', [regularHours, taskHours, sessionHours]);

const hoursEditFields = hoursFields.extend({ note: submittedHoursNote }).partial();

const hoursEditBody = hoursEditFields.refine(
  input => Object.keys(input).length > 0,
  { message: 'At least one hours field is required' },
);

// Normalize the submitted note and allow the task completion option on creation.
const hoursWriteBody = z.looseObject({ note: submittedHoursNote }).pipe(z.discriminatedUnion('type', [
  regularHours,
  taskHours.extend({ completeTask: z.boolean().optional() }),
  sessionHours,
]));

export const createHoursSchema = z.object({ body: hoursWriteBody });
export const editHoursSchema = hoursParamsSchema.extend({ body: hoursEditBody });

export type HoursCalendarQuery = z.infer<typeof hoursCalendarQuerySchema.shape.query>;
export type HoursTableQuery = z.infer<typeof hoursTableQuerySchema.shape.query>;
export type HoursCycleSummaryQuery = z.infer<typeof hoursCycleSummaryQuerySchema.shape.query>;
export type HoursPayPeriodQuery = z.infer<typeof hoursPayPeriodQuerySchema.shape.query>;
export type HoursSessionQuery = z.infer<typeof hoursSessionQuerySchema.shape.query>;
export type HoursCategory = Hours['category'];
