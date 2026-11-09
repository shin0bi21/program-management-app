import { z } from 'zod';
import { cursorListFields } from './listQuerySchemas';
import { calendarDateSchema } from './dateRangeValidation';

export const hoursCategorySchema = z.enum([
  'program_delivery',
  'planning_prep',
  'meeting',
  'administration',
  'outreach',
  'maintenance',
  'other',
]);

const dateSchema = calendarDateSchema();

export const hoursParamsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid time entry ID') }),
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
  types: commaSeparated(z.enum(['task', 'session', 'regular'])),
  cycleIds: commaSeparated(z.string().uuid('Invalid cycle ID')),
  search: z.string().trim().max(120).optional().default(''),
};

export const hoursCalendarQuerySchema = z.object({
  query: z.object({
    ...hoursFilterFields,
    start: dateSchema.optional(),
    end: dateSchema.optional(),
  }).refine(({ start, end }) => Boolean(start) === Boolean(end), {
    message: 'Start and end dates must be provided together',
    path: ['end'],
  }).refine(({ start, end }) => !start || !end || start <= end, {
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
  }).refine(({ start, end }) => Boolean(start) === Boolean(end), {
    message: 'Start and end dates must be provided together',
    path: ['end'],
  }).refine(({ start, end }) => !start || !end || start <= end, {
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

const sharedHoursFields = {
  staffId: z.string().uuid('Invalid staff ID'),
  hours: z.number().positive('Hours must be greater than zero').max(24, 'Hours cannot exceed 24'),
  note: z.string().trim().min(1, 'Note is required').max(2000, 'Note cannot exceed 2000 characters'),
};

const datedHoursFields = { ...sharedHoursFields, date: dateSchema };

export const setHoursSchema = z.object({
  body: z.discriminatedUnion('source', [
    z.object({
      ...datedHoursFields,
      source: z.literal('regular'),
      programId: z.string().uuid('Invalid program ID').nullable().optional().transform(value => value ?? null),
      category: hoursCategorySchema.exclude(['program_delivery']),
    }),
    z.object({
      ...datedHoursFields,
      source: z.literal('task'),
      taskId: z.string().uuid('Invalid task ID'),
      completeTask: z.boolean().optional().default(false),
    }),
    z.object({
      ...sharedHoursFields,
      source: z.literal('session'),
      sessionId: z.string().uuid('Invalid session ID'),
    }),
  ]),
});

export const updateHoursPlacementSchema = z.object({
  body: z.object({ date: dateSchema }),
});

export type HoursCalendarQuery = z.infer<typeof hoursCalendarQuerySchema.shape.query>;
export type HoursTableQuery = z.infer<typeof hoursTableQuerySchema.shape.query>;
export type HoursCycleSummaryQuery = z.infer<typeof hoursCycleSummaryQuerySchema.shape.query>;
export type HoursPayPeriodQuery = z.infer<typeof hoursPayPeriodQuerySchema.shape.query>;
export type HoursSessionQuery = z.infer<typeof hoursSessionQuerySchema.shape.query>;
export type SetHoursInput = z.infer<typeof setHoursSchema.shape.body>;
export type UpdateHoursPlacementInput = z.infer<typeof updateHoursPlacementSchema.shape.body>;
export type HoursCategory = z.infer<typeof hoursCategorySchema>;
