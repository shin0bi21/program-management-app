import { z } from 'zod';

const params = z.object({ id: z.string().uuid('Invalid youth ID') });
const noteParams = params.extend({ noteId: z.string().uuid('Invalid note ID') });
const body = z.object({
  category: z.enum(['general', 'health', 'preference']),
  title: z.string().trim().min(1, 'Title is required').max(5000),
  details: z.string().trim().max(5000).nullable().optional().transform(value => value || null),
});
export const youthProfileNotesSchema = z.object({ params });
export const createYouthProfileNoteSchema = z.object({ params, body });
export const updateYouthProfileNoteSchema = z.object({ params: noteParams, body });
export const deleteYouthProfileNoteSchema = z.object({ params: noteParams });
export type SetYouthProfileNoteInput = z.infer<typeof body>;
