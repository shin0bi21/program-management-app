import { Router } from 'express';
import {
  handleGetYouth,
  handleGetYouthAttendanceSummary,
  handleGetYouthSessionNotes,
  handleInviteYouth,
  handleSetYouth,
  handleSetYouthContacts,
  handleGetYouthProfileNotes,
  handleSetYouthProfileNote,
  handleDeleteYouthProfileNote,
  handleGetYouthProgramCycleAttendance,
  handleSetYouthProgramCycleAttendance,
} from '../controllers/youthController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest, asyncHandler } from '../middleware/routeMiddleware';
import {
  inviteYouthSchema,
  setYouthSchema,
  setYouthContactsSchema,
  youthQuerySchema,
  youthAttendanceSummarySchema,
  youthSessionNotesSchema,
  youthProgramCycleAttendanceSchema,
  setYouthProgramCycleAttendanceSchema,
} from '../validation/youthSchemas';
import { createYouthProfileNoteSchema, deleteYouthProfileNoteSchema, updateYouthProfileNoteSchema, youthProfileNotesSchema } from '../validation/youthProfileNoteSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:youth_profiles'), generalLimiter, validateRequest(youthQuerySchema), asyncHandler(handleGetYouth));
router.get('/:id/attendance-summary', authenticateToken, requirePermission('read:youth_profiles'), requirePermission('read:attendance'), generalLimiter, validateRequest(youthAttendanceSummarySchema), asyncHandler(handleGetYouthAttendanceSummary));
router.get('/:id/session-notes', authenticateToken, requirePermission('read:youth_profiles'), requirePermission('read:attendance'), generalLimiter, validateRequest(youthSessionNotesSchema), asyncHandler(handleGetYouthSessionNotes));
router.get('/:id/programs/:programId/cycles/:cycleId/attendance', authenticateToken, requirePermission('read:youth_profiles'), requirePermission('read:attendance'), requirePermission('read:sessions'), generalLimiter, validateRequest(youthProgramCycleAttendanceSchema), asyncHandler(handleGetYouthProgramCycleAttendance));
router.put('/:id/programs/:programId/cycles/:cycleId/attendance', authenticateToken, requirePermission('read:youth_profiles'), requirePermission('write:attendance'), requirePermission('read:sessions'), generalLimiter, validateRequest(setYouthProgramCycleAttendanceSchema), asyncHandler(handleSetYouthProgramCycleAttendance));
router.get('/:id/notes', authenticateToken, requirePermission('read:youth_profiles'), generalLimiter, validateRequest(youthProfileNotesSchema), asyncHandler(handleGetYouthProfileNotes));
router.post('/:id/notes', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(createYouthProfileNoteSchema), asyncHandler(handleSetYouthProfileNote));
router.put('/:id/notes/:noteId', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(updateYouthProfileNoteSchema), asyncHandler(handleSetYouthProfileNote));
router.delete('/:id/notes/:noteId', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(deleteYouthProfileNoteSchema), asyncHandler(handleDeleteYouthProfileNote));
router.put('/:id/contacts', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(setYouthContactsSchema), asyncHandler(handleSetYouthContacts));
router.post('/', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(setYouthSchema), asyncHandler(handleSetYouth));
router.post('/:id/invite', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(inviteYouthSchema), asyncHandler(handleInviteYouth));

export default router;
