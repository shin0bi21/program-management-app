import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format');
const weekdaySchema = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);
const commaSeparated = <T extends z.ZodType>(schema: T) => z.preprocess(value => {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
}, z.array(schema).max(20));

export const cohortQuerySchema = z.object({
  query: z.object({
    programId: z.string().uuid('Invalid program ID').optional(),
    scope: z.enum(['all']).optional(),
  }),
});

export const createCohortSchema = z.object({
  body: z.object({
    programId: z.string().uuid('Invalid program ID'),
    name: z.string().trim().min(1).max(120),
    startsOn: dateSchema,
    endsOn: dateSchema,
  }).refine(data => data.endsOn >= data.startsOn, {
    message: 'Cohort end date must be on or after its start date',
    path: ['endsOn'],
  }),
});
export const updateCohortSchema = z.object({
  params: z.object({ cohortId: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(1).max(120),
    startsOn: dateSchema,
    endsOn: dateSchema,
  }).refine(data => data.endsOn >= data.startsOn, {
    message: 'Cohort end date must be on or after its start date',
    path: ['endsOn'],
  }),
});
export const deleteCohortSchema = z.object({
  params: z.object({ cohortId: z.string().uuid() }),
});

export const enrollYouthSchema = z.object({
  params: z.object({ cohortId: z.string().uuid('Invalid cohort ID') }),
  body: z.object({
    youthIds: z.array(z.string().uuid('Invalid youth ID')).min(1).max(200),
  }).refine(data => new Set(data.youthIds).size === data.youthIds.length, {
    message: 'Youth selections must be unique',
    path: ['youthIds'],
  }),
});

export const withdrawYouthSchema = z.object({
  params: z.object({
    cohortId: z.string().uuid('Invalid cohort ID'),
    youthId: z.string().uuid('Invalid youth ID'),
  }),
});

export const generateSessionsSchema = z.object({
  params: z.object({ cohortId: z.string().uuid('Invalid cohort ID') }),
  body: z.object({
    sessionTypeId: z.string().uuid('Invalid session type ID')
      .default('00000000-0000-4000-8000-000000000001'),
    theme: z.string().trim().max(160).nullable().optional().transform(value => value || null),
    frequency: z.enum(['once', 'weekly', 'biweekly', 'monthly']),
    dayOfWeek: weekdaySchema.optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    startsOn: dateSchema,
    endsOn: dateSchema.optional(),
    startTime: timeSchema,
    endTime: timeSchema,
  }).superRefine((data, context) => {
    if (data.endTime <= data.startTime) {
      context.addIssue({ code: 'custom', message: 'End time must be after start time', path: ['endTime'] });
    }
    if (data.frequency !== 'once' && !data.endsOn) {
      context.addIssue({ code: 'custom', message: 'End date is required for recurring activities', path: ['endsOn'] });
    }
    if ((data.frequency === 'weekly' || data.frequency === 'biweekly') && !data.dayOfWeek) {
      context.addIssue({ code: 'custom', message: 'Day of week is required', path: ['dayOfWeek'] });
    }
    if (data.frequency === 'monthly' && !data.dayOfMonth) {
      context.addIssue({ code: 'custom', message: 'Day of month is required', path: ['dayOfMonth'] });
    }
    if (data.endsOn && data.endsOn < data.startsOn) {
      context.addIssue({ code: 'custom', message: 'End date must be on or after start date', path: ['endsOn'] });
    }
  }),
});

export const sessionQuerySchema = z.object({
  query: z.object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    programIds: commaSeparated(z.string().uuid('Invalid program ID')),
    cohortId: z.string().uuid('Invalid cohort ID').optional(),
    sessionTypeIds: commaSeparated(z.string().uuid('Invalid session type ID')),
    statuses: commaSeparated(z.enum(['upcoming', 'completed'])),
    search: z.string().trim().max(120).optional().default(''),
  }),
});

export const sessionListQuerySchema = z.object({
  query: z.object({
    programIds: commaSeparated(z.string().uuid('Invalid program ID')),
    cohortId: z.string().uuid('Invalid cohort ID').optional(),
    sessionTypeIds: commaSeparated(z.string().uuid('Invalid session type ID')),
    statuses: commaSeparated(z.enum(['upcoming', 'completed'])),
    search: z.string().trim().max(120).optional().default(''),
  }),
});

export const saveAttendanceSchema = z.object({
  params: z.object({ sessionId: z.string().uuid('Invalid session ID') }),
  body: z.object({
    records: z.array(z.object({
      youthId: z.string().uuid('Invalid youth ID'),
      status: z.enum(['present', 'absent', 'late', 'excused']),
      notes: z.string().trim().max(5000).nullable().optional(),
    })).max(200).refine(
      records => new Set(records.map(record => record.youthId)).size === records.length,
      { message: 'Attendance records must contain unique youth' },
    ),
  }),
});
export const updateSessionSchema = z.object({
  params: z.object({ sessionId: z.string().uuid() }),
  body: z.object({
    sessionTypeId: z.string().uuid('Invalid session type ID').optional(),
    theme: z.string().trim().max(160).nullable().optional().transform(value => value || null),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    description: z.string().trim().max(5000).nullable().optional(),
  }).refine(data => data.endsAt > data.startsAt, {
    message: 'Session end time must be after its start time',
    path: ['endsAt'],
  }),
});
export const deleteSessionSchema = z.object({
  params: z.object({ sessionId: z.string().uuid() }),
});
export const sessionNotesSchema = z.object({
  params: z.object({ sessionId: z.string().uuid('Invalid session ID') }),
});
export const createSessionNoteSchema = z.object({
  params: z.object({ sessionId: z.string().uuid('Invalid session ID') }),
  body: z.object({
    category: z.enum(['general', 'attendance', 'behaviour', 'achievement', 'follow_up']),
    title: z.string().trim().min(1, 'Title is required').max(160),
    details: z.string().trim().max(5000).nullable().optional().transform(value => value || null),
    youthIds: z.array(z.string().uuid('Invalid youth ID')).max(50).default([]),
  }).refine(
    data => new Set(data.youthIds).size === data.youthIds.length,
    { message: 'Youth attachments must be unique', path: ['youthIds'] },
  ),
});
export const updateSessionNoteSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID'),
    noteId: z.string().uuid('Invalid note ID'),
  }),
  body: createSessionNoteSchema.shape.body,
});
export const deleteSessionNoteSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID'),
    noteId: z.string().uuid('Invalid note ID'),
  }),
});

export type CreateCohortInput = z.infer<typeof createCohortSchema.shape.body>;
export type UpdateCohortInput = z.infer<typeof updateCohortSchema.shape.body>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema.shape.body>;
export type EnrollYouthInput = z.infer<typeof enrollYouthSchema.shape.body>;
export type GenerateSessionsInput = z.infer<typeof generateSessionsSchema.shape.body>;
export type SessionCalendarQuery = z.infer<typeof sessionQuerySchema.shape.query>;
export type SessionListQuery = z.infer<typeof sessionListQuerySchema.shape.query>;
export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema.shape.body>;
export type CreateSessionNoteInput = z.infer<typeof createSessionNoteSchema.shape.body>;
export type UpdateSessionNoteInput = z.infer<typeof updateSessionNoteSchema.shape.body>;
