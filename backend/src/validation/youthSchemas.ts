import { z } from 'zod';
import { cursorListFields } from './listQuerySchemas';

const commaSeparated = (schema: z.ZodType<string>) => z.preprocess(value => {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
}, z.array(schema).max(20));

export const youthQuerySchema = z.object({
  query: z.object({
    id: z.string().uuid('Invalid youth ID').optional(),
    search: z.string().trim().max(120).optional().default(''),
    programIds: commaSeparated(z.string().uuid('Invalid program ID')),
    cycleIds: commaSeparated(z.string().uuid('Invalid cycle ID')),
    ...cursorListFields(['firstName', 'lastName', 'age', 'school', 'grade', 'program', 'status'], 'firstName', 'asc'),
  }),
});

export const youthSessionNotesSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid youth ID') }),
});

export const youthCohortAttendanceSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid youth ID'),
    cohortId: z.string().uuid('Invalid cohort ID'),
  }),
});

export const setYouthCohortAttendanceSchema = z.object({
  params: youthCohortAttendanceSchema.shape.params,
  body: z.object({
    records: z.array(z.object({
      sessionId: z.string().uuid('Invalid session ID'),
      status: z.enum(['present', 'absent', 'late', 'excused']).nullable(),
      notes: z.string().trim().max(5000).nullable().optional(),
    })).max(250).refine(
      records => new Set(records.map(record => record.sessionId)).size === records.length,
      { message: 'Attendance records must contain unique sessions' },
    ),
  }),
});

export type SetYouthCohortAttendanceInput = z.infer<typeof setYouthCohortAttendanceSchema.shape.body>;

export type YouthQuery = z.infer<typeof youthQuerySchema.shape.query>;

export const setYouthSchema = z.object({
  body: z.object({
    id: z.string().uuid('Invalid youth ID').optional(),
    firstName: z
      .string()
      .min(1, 'First name is required')
      .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
    email: z.string().trim().email('Invalid email format').optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional(),
    schoolId: z.string().uuid('Invalid school ID').optional(),
    gradeLevel: z.number().int().min(0).max(12).optional(),
    addresses: z
      .array(
        z.object({
          id: z.string().uuid('Invalid address ID').optional(),
          address: z.string().min(1, 'Street address is required'),
        }),
      )
      .optional(),
    contacts: z
      .array(
        z.object({
          id: z.string().uuid('Invalid contact ID').optional(),
          phoneNumber: z.string().trim().min(1, 'Contact phone number is required'),
          type: z.enum(['parent', 'sibling', 'guardian', 'emergency']).default('parent'),
        }),
      )
      .optional(),
  }),
});

export type SetYouthInput = z.infer<typeof setYouthSchema>;

export const inviteYouthSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid youth ID') }),
  body: z.object({ email: z.string().trim().email('Invalid email format') }),
});
