import { SESSION_TYPES } from '../types/programming';
import { z } from 'zod';
import { cursorListFields } from './listQuerySchemas';
import { calendarDateSchema } from './dateRangeValidation';

const dateSchema = calendarDateSchema();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm');

/**
 * Parses at most 20 filter values from comma-separated strings or repeated query parameters.
 * @param schema - Validation applied to each supplied filter value.
 * @example commaSeparated(z.string()).parse('a,b') // ['a', 'b']
 */
const commaSeparated = <T extends z.ZodType>(schema: T) => z.preprocess(value => {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
}, z.array(schema).max(20));

const programCycleParams = z.object({
  programId: z.string().uuid('Invalid program ID'),
  cycleId: z.string().uuid('Invalid cycle ID'),
});

export const programCycleQuerySchema = z.object({
  query: z.object({
    programId: z.string().uuid('Invalid program ID').optional(),
    cycleId: z.string().uuid('Invalid cycle ID').optional(),
    scope: z.enum(['all']).optional(),
  }),
});

export const cycleListQuerySchema = z.object({
  query: z.object({ ...cursorListFields(['title', 'startsOn'], 'startsOn', 'desc') }),
});

export type CycleListQuery = z.infer<typeof cycleListQuerySchema.shape.query>;

export const createCycleSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(120),
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
export const updateCycleSchema = z.object({
  params: z.object({ cycleId: z.string().uuid('Invalid cycle ID') }),
  body: createCycleSchema.shape.body,
});
export const deleteCycleSchema = z.object({
  params: z.object({ cycleId: z.string().uuid('Invalid cycle ID') }),
});
export const programCycleAttendanceSchema = z.object({
  params: programCycleParams,
});

export const attendanceReportSchema = z.object({
  params: programCycleParams,
  body: z.object({
    programCycle: z.object({
      ...programCycleParams.shape,
      program: z.string().min(1),
      cycle: z.string().min(1),
      enrollmentRequired: z.boolean(),
    }),
    youth: z.array(z.object({
      id: z.string().uuid('Invalid youth ID'),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      sessions: z.array(z.object({
        id: z.string().uuid('Invalid session ID'),
        sessionType: z.enum(SESSION_TYPES),
        title: z.string(),
        date: dateSchema,
        startTime: timeSchema,
        completed: z.boolean(),
        cancelledAt: z.string().datetime({ offset: true }).nullable(),
        status: z.enum(['present', 'late', 'absent', 'excused']).nullable(),
        sessionNotes: z.array(z.object({
          id: z.string().uuid('Invalid note ID'),
          category: z.enum(['general', 'attendance', 'behaviour', 'achievement']),
          details: z.string().max(5000),
          createdAt: z.string().datetime({ offset: true }),
        })),
      })),
    })),
  }),
}).refine(data => (
  data.body.programCycle.programId === data.params.programId
  && data.body.programCycle.cycleId === data.params.cycleId
), {
  message: 'Report data must match the requested program and cycle',
  path: ['body', 'programCycle'],
});

export const programRosterSchema = z.object({
  params: programCycleParams,
});

export const setProgramRosterSchema = z.object({
  params: programCycleParams,
  body: z.object({
    youthIds: z.array(z.string().uuid('Invalid youth ID')).max(500).refine(
      values => new Set(values).size === values.length, 'Youth selections must be unique',
    ),
  }).strict(),
});

export const enrollYouthSchema = z.object({
  params: programCycleParams,
  body: z.object({
    youthIds: z.array(z.string().uuid('Invalid youth ID')).min(1).max(200),
  }).refine(data => new Set(data.youthIds).size === data.youthIds.length, {
    message: 'Youth selections must be unique',
    path: ['youthIds'],
  }),
});

export const withdrawYouthSchema = z.object({
  params: z.object({
    ...programCycleParams.shape,
    youthId: z.string().uuid('Invalid youth ID'),
  }),
});

const createSessionBodySchema = z.object({
  sessionType: z.enum(SESSION_TYPES),
  title: z.string().trim().min(1, 'Title is required').max(160),
  date: dateSchema.optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  description: z.string().trim().max(5000).nullable().optional(),
}).strict();

/**
 * Requires supplied end times to follow start times; omitted values use program defaults later.
 * @param data - Optional clock times using HH:mm.
 * @example validSessionTimes({ startTime: '17:00', endTime: '18:00' }) // true
 */
const validSessionTimes = (data: { startTime?: string; endTime?: string }) => (
  !data.startTime || !data.endTime || data.endTime > data.startTime
);

const sessionTimeError = { message: 'End time must be after start time', path: ['endTime'] };

export const createSessionSchema = z.object({
  params: programCycleParams,
  body: createSessionBodySchema.refine(validSessionTimes, sessionTimeError),
});

export const createProgramSessionSchema = z.object({
  body: createSessionBodySchema.extend({
    programId: z.string().uuid('Invalid program ID'),
  })
    .refine(validSessionTimes, sessionTimeError),
});

export const sessionListQuerySchema = z.object({
  query: z.object({
    start: dateSchema.optional(),
    end: dateSchema.optional(),
    programIds: commaSeparated(z.string().uuid('Invalid program ID')),
    cycleIds: commaSeparated(z.string().uuid('Invalid cycle ID')),
    sessionTypes: commaSeparated(z.enum(SESSION_TYPES)),
    statuses: commaSeparated(z.enum(['upcoming', 'completed'])),
    search: z.string().trim().max(120).optional().default(''),
    ...cursorListFields(['program', 'cycle', 'title', 'date', 'time', 'type', 'status'], 'date', 'desc'),
  }).refine(data => Boolean(data.start) === Boolean(data.end), {
    message: 'Session range requires both start and end',
    path: ['end'],
  }).refine(data => !data.start || !data.end || data.start <= data.end, {
    message: 'Session range end must be on or after start',
    path: ['end'],
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
  body: z.object({ date: dateSchema }).strict(),
});

export const updateSessionSchema = z.object({
  params: z.object({ sessionId: z.string().uuid() }),
  body: z.object({
    sessionType: z.enum(SESSION_TYPES).optional(),
    title: z.string().trim().min(1, 'Title is required').max(160),
    date: dateSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    description: z.string().trim().max(5000).nullable().optional(),
  }).strict().refine(validSessionTimes, sessionTimeError),
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

export type SetProgramCycleInput = z.infer<typeof updateCycleSchema.shape.body>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema.shape.body>;
export type SetProgramRosterInput = z.infer<typeof setProgramRosterSchema.shape.body>;
export type EnrollYouthInput = z.infer<typeof enrollYouthSchema.shape.body>;
export type SessionListQuery = z.infer<typeof sessionListQuerySchema.shape.query>;
export type ProgramCycleQuery = z.infer<typeof programCycleQuerySchema.shape.query>;
export type AttendanceReportInput = z.infer<typeof attendanceReportSchema>['body'];
export type SetAttendanceInput = z.infer<typeof saveAttendanceSchema.shape.body>;
export type CreateSessionNoteInput = z.infer<typeof createSessionNoteSchema.shape.body>;
export type UpdateSessionNoteInput = z.infer<typeof updateSessionNoteSchema.shape.body>;
export type CreateSessionAttachmentInput = z.infer<typeof createSessionAttachmentSchema.shape.body>;
export type UpdateSessionAttachmentInput = z.infer<typeof updateSessionAttachmentSchema.shape.body>;

export type CreateSessionInput = z.infer<typeof createSessionSchema.shape.body>;

export type CreateProgramSessionInput = z.infer<typeof createProgramSessionSchema.shape.body>;
