import { z } from 'zod';

const leadParams = z.object({ id: z.string().uuid('Invalid lead ID') });
const noteParams = leadParams.extend({ noteId: z.string().uuid('Invalid note ID') });
const noteBody = z.object({
  details: z.string().trim().min(1, 'Note is required').max(500, 'Note must be 500 characters or fewer'),
}).strict();

export const leadNotesSchema = z.object({ params: leadParams });
export const createLeadNoteSchema = z.object({ params: leadParams, body: noteBody });
export const updateLeadNoteSchema = z.object({ params: noteParams, body: noteBody });
export const deleteLeadNoteSchema = z.object({ params: noteParams });
export type SetLeadNoteInput = z.infer<typeof noteBody>;
