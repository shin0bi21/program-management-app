import { z } from 'zod';
import { cursorListFields } from './listQuerySchemas';
import { DATE_RANGE_LIMIT_MESSAGE, exceedsDateRangeLimit, isCalendarDate, sessionRangeCalendarDates } from './dateRangeValidation';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format');
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
    cycleId: z.string().uuid('Invalid cycle ID').optional(),
    scope: z.enum(['all']).optional(),
    search: z.string().trim().max(120).optional().default(''),
    status: z.enum(['active', 'upcoming', 'completed']).optional(),
    ...cursorListFields(['program', 'cohort', 'start', 'end', 'status'], 'start', 'desc'),
  }),
});

export const createCohortSchema = z.object({
  body: z.object({
    programId: z.string().uuid('Invalid program ID'),
    cycleId: z.string().uuid('Invalid cycle ID'),
  }),
});
export const createCycleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    startsOn: dateSchema,
    endsOn: dateSchema,
    programIds: z.array(z.string().uuid()).max(500).refine(
      values => new Set(values).size === values.length, 'Program IDs must be unique',
    ),
  }).refine(data => data.endsOn >= data.startsOn, {
    message: 'Cycle end date must be on or after its start date',
    path: ['endsOn'],
  }),
});
export const updateCohortSchema = z.object({
  params: z.object({ cohortId: z.string().uuid() }),
  body: z.object({
    cycleId: z.string().uuid('Invalid cycle ID'),
  }),
});
export const updateCycleSchema = z.object({
  params: z.object({ cycleId: z.string().uuid('Invalid cycle ID') }),
  body: createCycleSchema.shape.body,
});
export const deleteCycleSchema = z.object({
  params: z.object({ cycleId: z.string().uuid('Invalid cycle ID') }),
});
export const deleteCohortSchema = z.object({
  params: z.object({ cohortId: z.string().uuid() }),
});

export const cohortYouthReportSchema = z.object({
  params: z.object({ cohortId: z.string().uuid() }),
  query: z.object({ youthId: z.string().uuid('Invalid youth ID').optional() }),
});

export const cohortRosterSchema = z.object({
  params: z.object({ cohortId: z.string().uuid('Invalid cohort ID') }),
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

const createSessionBodySchema = z.object({
  sessionTypeId: z.string().uuid('Invalid session type ID'),
  theme: z.string().trim().min(1, 'Title / Theme is required').max(160),
  date: z.iso.date().optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  description: z.string().trim().max(5000).nullable().optional(),
});

const validSessionTimes = (data: { startTime?: string; endTime?: string }) => (
  !data.startTime || !data.endTime || data.endTime > data.startTime
);
const sessionTimeError = { message: 'End time must be after start time', path: ['endTime'] };

export const createSessionSchema = z.object({
  params: z.object({ cohortId: z.string().uuid('Invalid cohort ID') }),
  body: createSessionBodySchema.refine(validSessionTimes, sessionTimeError),
});

export const createProgramSessionSchema = z.object({
  body: createSessionBodySchema.extend({ programId: z.string().uuid('Invalid program ID') })
    .refine(validSessionTimes, sessionTimeError),
});

export const generateSessionsSchema = z.object({
  params: z.object({ cohortId: z.string().uuid('Invalid cohort ID') }),
  body: z.object({
    sessionTypeId: z.string().uuid('Invalid session type ID')
      .default('00000000-0000-4000-8000-000000000001'),
    theme: z.string().trim().min(1, 'Title / Theme is required').max(160),
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

export const sessionListQuerySchema = z.object({
  query: z.object({
    start: z.string().datetime({ offset: true }).refine(value => isCalendarDate(value.slice(0, 10)), 'Start must use a supported calendar year').optional(),
    end: z.string().datetime({ offset: true }).refine(value => isCalendarDate(value.slice(0, 10)), 'End must use a supported calendar year').optional(),
    programIds: commaSeparated(z.string().uuid('Invalid program ID')),
    cycleIds: commaSeparated(z.string().uuid('Invalid cycle ID')),
    cohortId: z.string().uuid('Invalid cohort ID').optional(),
    sessionTypeIds: commaSeparated(z.string().uuid('Invalid session type ID')),
    statuses: commaSeparated(z.enum(['upcoming', 'completed'])),
    search: z.string().trim().max(120).optional().default(''),
    ...cursorListFields(['program', 'cohort', 'theme', 'date', 'time', 'type', 'status'], 'date', 'desc'),
  }).superRefine((data, context) => {
    if (Boolean(data.start) !== Boolean(data.end)) {
      context.addIssue({
        code: 'custom',
        message: 'Session range requires both start and end',
        path: [data.start ? 'end' : 'start'],
      });
    }
    if (data.start && data.end && Date.parse(data.end) <= Date.parse(data.start)) {
      context.addIssue({
        code: 'custom',
        message: 'Session range end must be after start',
        path: ['end'],
      });
    }
    if (data.start && data.end && Date.parse(data.end) > Date.parse(data.start)) {
      const dates = sessionRangeCalendarDates(data.start, data.end);
      if (!dates) {
        context.addIssue({ code: 'custom', message: 'Session range must use supported calendar dates', path: ['end'] });
      } else if (exceedsDateRangeLimit(dates.start, dates.end)) {
        context.addIssue({ code: 'custom', message: DATE_RANGE_LIMIT_MESSAGE, path: ['end'] });
      }
    }
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
export const moveSessionDateSchema = z.object({
  params: z.object({ sessionId: z.string().uuid('Invalid session ID') }),
  body: z.object({ date: z.iso.date() }).strict(),
});

export const updateSessionSchema = z.object({
  params: z.object({ sessionId: z.string().uuid() }),
  body: z.object({
    sessionTypeId: z.string().uuid('Invalid session type ID').optional(),
    theme: z.string().trim().min(1, 'Title / Theme is required').max(160),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    description: z.string().trim().max(5000).nullable().optional(),
  }).refine(data => Date.parse(data.endsAt) > Date.parse(data.startsAt), {
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
    category: z.enum(['general', 'attendance', 'behaviour', 'achievement']),
    details: z.string().trim().min(1, 'Note is required').max(5000),
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
export const unlinkSessionNoteYouthSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID'),
    noteId: z.string().uuid('Invalid note ID'),
    youthId: z.string().uuid('Invalid youth ID'),
  }),
});

const multipartYouthIds = z.preprocess(value => {
  if (value === undefined || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.array(z.string().uuid('Invalid youth ID')).max(50));

export const sessionAttachmentsSchema = z.object({
  params: z.object({ sessionId: z.string().uuid('Invalid session ID') }),
});
export const createSessionAttachmentSchema = z.object({
  params: sessionAttachmentsSchema.shape.params,
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(160),
    description: z.string().trim().max(5000).optional().transform(value => value || null),
    youthIds: multipartYouthIds,
  }).refine(data => new Set(data.youthIds).size === data.youthIds.length, {
    message: 'Youth attachments must be unique',
    path: ['youthIds'],
  }),
});
export const updateSessionAttachmentSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID'),
    attachmentId: z.string().uuid('Invalid attachment ID'),
  }),
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(160),
    description: z.string().trim().max(5000).nullable().transform(value => value || null),
    youthIds: z.array(z.string().uuid('Invalid youth ID')).max(50),
  }).refine(data => new Set(data.youthIds).size === data.youthIds.length, {
    message: 'Youth attachments must be unique',
    path: ['youthIds'],
  }),
});
export const sessionAttachmentParamsSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID'),
    attachmentId: z.string().uuid('Invalid attachment ID'),
  }),
});

export type CreateCohortInput = z.infer<typeof createCohortSchema.shape.body>;
export type UpdateCohortInput = z.infer<typeof updateCohortSchema.shape.body>;
export type SetProgramCycleInput = z.infer<typeof updateCycleSchema.shape.body>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema.shape.body>;
export type EnrollYouthInput = z.infer<typeof enrollYouthSchema.shape.body>;
export type GenerateSessionsInput = z.infer<typeof generateSessionsSchema.shape.body>;
export type SessionListQuery = z.infer<typeof sessionListQuerySchema.shape.query>;
export type CohortQuery = z.infer<typeof cohortQuerySchema.shape.query>;
export type CohortYouthReportQuery = z.infer<typeof cohortYouthReportSchema.shape.query>;
export type SetAttendanceInput = z.infer<typeof saveAttendanceSchema.shape.body>;
export type CreateSessionNoteInput = z.infer<typeof createSessionNoteSchema.shape.body>;
export type UpdateSessionNoteInput = z.infer<typeof updateSessionNoteSchema.shape.body>;
export type CreateSessionAttachmentInput = z.infer<typeof createSessionAttachmentSchema.shape.body>;
export type UpdateSessionAttachmentInput = z.infer<typeof updateSessionAttachmentSchema.shape.body>;

export type CreateSessionInput = z.infer<typeof createSessionSchema.shape.body>;

export type CreateProgramSessionInput = z.infer<typeof createProgramSessionSchema.shape.body>;
