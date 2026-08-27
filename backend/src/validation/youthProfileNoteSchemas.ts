import { z } from 'zod';

const params = z.object({ id: z.string().uuid('Invalid youth ID') });
const noteParams = params.extend({ noteId: z.string().uuid('Invalid note ID') });
const body = z.object({
  category: z.enum(['general', 'health', 'preference']),
  details: z.string().trim().min(1, 'Note is required').max(5000),
});
export const youthProfileNotesSchema = z.object({ params });
export const createYouthProfileNoteSchema = z.object({ params, body });
export const updateYouthProfileNoteSchema = z.object({ params: noteParams, body });
export const deleteYouthProfileNoteSchema = z.object({ params: noteParams });
export type SetYouthProfileNoteInput = z.infer<typeof body>;
