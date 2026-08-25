import { z } from 'zod';
import { cursorListFields } from './listQuerySchemas';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

export const hoursCategorySchema = z.enum([
  'program_delivery',
  'planning_prep',
  'meeting',
  'administration',
  'outreach',
  'maintenance',
  'other',
]);

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD')
  .refine(value => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day;
  }, 'Date must be a valid calendar date');

export const hoursParamsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid time entry ID') }),
});

export const hoursCalendarQuerySchema = z.object({
  query: z.object({
    start: dateSchema.optional(),
    end: dateSchema.optional(),
    cycleId: z.string().uuid('Invalid cycle ID').optional(),
  }).refine(({ start, end }) => Boolean(start) === Boolean(end), {
    message: 'Start and end dates must be provided together',
    path: ['end'],
  }).refine(({ start, end }) => !start || !end || start <= end, {
    message: 'Start date must be on or before end date',
    path: ['end'],
  }).refine(({ start, end }) => !start || !end || (
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS < MAX_RANGE_DAYS
  ), {
    message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
    path: ['end'],
  }),
});

const commaSeparated = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(value => (
  typeof value === 'string' && value ? value.split(',') : []
), z.array(schema));

export const hoursTableQuerySchema = z.object({
  query: z.object({
    staffIds: commaSeparated(z.string().uuid('Invalid staff ID')),
    categories: commaSeparated(hoursCategorySchema),
    programIds: commaSeparated(z.union([z.string().uuid('Invalid program ID'), z.literal('general')])),
    types: commaSeparated(z.enum(['task', 'session', 'other'])),
    cycleId: z.string().uuid('Invalid cycle ID').optional(),
    search: z.string().trim().max(120).optional().default(''),
    ...cursorListFields(['firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'hours', 'note', 'type'], 'date', 'desc'),
  }),
});

export const hoursSessionQuerySchema = z.object({
  query: z.object({
    staffId: z.string().uuid('Invalid staff ID'),
    workDate: dateSchema,
  }),
});

export const hoursDashboardQuerySchema = z.object({
  query: z.object({
    staffId: z.string().uuid('Invalid staff ID'),
    cycleId: z.string().uuid('Invalid cycle ID'),
  }),
});

const sharedHoursFields = {
  staffId: z.string().uuid('Invalid staff ID'),
  hours: z.number().positive('Hours must be greater than zero').max(24, 'Hours cannot exceed 24'),
  note: z.string().trim().min(1, 'Note is required').max(2000, 'Note cannot exceed 2000 characters'),
};

const datedHoursFields = { ...sharedHoursFields, workDate: dateSchema };

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
  body: z.object({ workDate: dateSchema }),
});

export type HoursCalendarQuery = z.infer<typeof hoursCalendarQuerySchema.shape.query>;
export type HoursTableQuery = z.infer<typeof hoursTableQuerySchema.shape.query>;
export type HoursDashboardQuery = z.infer<typeof hoursDashboardQuerySchema.shape.query>;
export type HoursSessionQuery = z.infer<typeof hoursSessionQuerySchema.shape.query>;
export type SetHoursInput = z.infer<typeof setHoursSchema.shape.body>;
export type UpdateHoursPlacementInput = z.infer<typeof updateHoursPlacementSchema.shape.body>;
export type HoursCategory = z.infer<typeof hoursCategorySchema>;
