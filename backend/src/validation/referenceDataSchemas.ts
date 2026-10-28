import { z } from 'zod';

export const programReferenceDataSchema = z.object({
  query: z.object({ assignedOnly: z.enum(['true', 'false']).default('false').transform(value => value === 'true') }),
});

export const staffReferenceDataSchema = z.object({
  query: z.object({ feature: z.enum(['tasks', 'hours']) }),
});

export type StaffReferenceFeature = z.infer<typeof staffReferenceDataSchema.shape.query>['feature'];
export type ProgramReferenceDataQuery = z.infer<typeof programReferenceDataSchema.shape.query>;
