import { z } from 'zod';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

export const timeEntryTaskSchema = z.enum([
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

export const timeEntryParamsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid time entry ID') }),
});

export const timeEntryQuerySchema = z.object({
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

export const timeEntryCohortQuerySchema = z.object({
  query: z.object({ programId: z.string().uuid('Invalid program ID') }),
});

export const setTimeEntrySchema = z.object({
  body: z.object({
    staffId: z.string().uuid('Invalid staff ID'),
    programId: z.string().uuid('Invalid program ID').nullable().optional().transform(value => value ?? null),
    cycleId: z.string().uuid('Invalid cycle ID'),
    task: timeEntryTaskSchema,
    workDate: dateSchema,
    hours: z.number().positive('Hours must be greater than zero').max(24, 'Hours cannot exceed 24'),
    note: z.string().trim().min(1, 'Note is required').max(2000, 'Note cannot exceed 2000 characters'),
  }),
});

export type TimeEntryQuery = z.infer<typeof timeEntryQuerySchema.shape.query>;
export type SetTimeEntryInput = z.infer<typeof setTimeEntrySchema.shape.body>;
