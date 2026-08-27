import { z } from 'zod';

const leadParams = z.object({ id: z.string().uuid('Invalid lead ID') });
const noteBody = z.object({
  category: z.enum(['new', 'contacted', 'eligible', 'ineligible', 'deferred', 'closed']),
  details: z.string().trim().min(1, 'Note is required').max(500, 'Note must be 500 characters or fewer'),
}).strict();

export const leadNotesSchema = z.object({ params: leadParams });
export const createLeadNoteSchema = z.object({ params: leadParams, body: noteBody });
export type SetLeadNoteInput = z.infer<typeof noteBody>;
