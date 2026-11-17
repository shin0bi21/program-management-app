import { z } from 'zod';
import { cursorListFields } from './listQuerySchemas';
import { dateOfBirthSchema } from './dateOfBirth';
import { attendanceQuerySchema, attendanceYouthIdsSchema } from './programmingSchemas';

const youthContactSchema = z.object({
  id: z.string().uuid('Invalid contact ID').optional(),
  phoneNumber: z.string().trim().min(1, 'Contact phone number is required'),
  type: z.enum(['parent', 'sibling', 'guardian']).default('parent'),
});

export const setYouthContactsSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid youth ID') }),
  body: z.object({
    contacts: z.array(youthContactSchema).refine(contacts => {
      const ids = contacts.flatMap(contact => contact.id ? [contact.id.toLowerCase()] : []);
      return new Set(ids).size === ids.length;
    }, { message: 'Contacts cannot contain duplicate IDs' }),
  }).strict(),
});

export type SetYouthContactsInput = z.infer<typeof setYouthContactsSchema.shape.body>;

/**
 * Accepts query selections as comma-separated text or repeated query parameters.
 * @param schema - Validation to apply to each selected value, such as a program UUID.
 * @returns A parser that defaults missing selections to an empty list and allows at most 20 values.
 * @example commaSeparated(z.string().uuid()) // parser for a list of selected IDs
 */
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
    ...cursorListFields(['firstName', 'lastName', 'dateOfBirth', 'school', 'activeProgram'], 'firstName', 'asc'),
  }),
});

export const youthSessionNotesSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid youth ID') }),
});

export const youthAttendanceSchema = z.object({
  query: attendanceQuerySchema.extend({ youthIds: attendanceYouthIdsSchema }),
});

export const setAttendanceSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid youth ID'),
    programId: z.string().uuid('Invalid program ID'),
    cycleId: z.string().uuid('Invalid cycle ID'),
  }),
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

export type SetAttendanceInput = z.infer<typeof setAttendanceSchema.shape.body>;

export type YouthQuery = z.infer<typeof youthQuerySchema.shape.query>;

export const setYouthSchema = z.object({
  body: z.object({
    id: z.string().uuid('Invalid youth ID').optional(),
    firstName: z.string().trim().min(1, 'First name is required').max(120, 'First name is too long'),
    lastName: z.string().trim().min(1, 'Last name is required').max(120, 'Last name is too long'),
    email: z.string().trim().email('Invalid email format').optional(),
    dateOfBirth: dateOfBirthSchema.nullable().optional(),
    schoolId: z.string().uuid('Invalid school ID').optional(),
    addresses: z
      .array(
        z.object({
          id: z.string().uuid('Invalid address ID').optional(),
          address: z.string().min(1, 'Street address is required'),
        }),
      )
      .optional(),
    contacts: z.array(youthContactSchema).optional(),
  }),
});

export type SetYouthInput = z.infer<typeof setYouthSchema>;

export const inviteYouthSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid youth ID') }),
  body: z.object({ email: z.string().trim().email('Invalid email format') }),
});
