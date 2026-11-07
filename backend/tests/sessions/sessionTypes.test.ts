import { createProgramSessionSchema, sessionListQuerySchema, updateSessionSchema } from '../../src/validation/programmingSchemas';

const programId = '00000000-0000-4000-8000-000000000011';
const sessionId = '00000000-0000-4000-8000-000000000012';

it.each(['Regular', 'Guest Speaker', 'Field Trip'])('accepts the fixed session type %s in creates, edits, and filters', sessionType => {
  const body = { programId, sessionType, theme: 'Type validation' };
  const edit = { sessionType, theme: 'Type validation', startsAt: '2030-01-01T17:00:00Z', endsAt: '2030-01-01T18:00:00Z' };

  expect(createProgramSessionSchema.safeParse({ body }).success).toBe(true);
  expect(updateSessionSchema.safeParse({ params: { sessionId }, body: edit }).success).toBe(true);
  expect(sessionListQuerySchema.safeParse({ query: { sessionTypes: sessionType } }).success).toBe(true);
});

it.each(['Custom', '00000000-0000-4000-8000-000000000001'])('rejects unsupported or obsolete session type %s', sessionType => {
  expect(createProgramSessionSchema.safeParse({ body: { programId, sessionType, theme: 'Type validation' } }).success).toBe(false);
  expect(sessionListQuerySchema.safeParse({ query: { sessionTypes: sessionType } }).success).toBe(false);
});
