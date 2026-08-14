import { Router } from 'express';
import {
  handleGetYouth,
  handleGetYouthSessionNotes,
  handleInviteYouth,
  handleSetYouth,
  handleGetYouthProfileNotes,
  handleSetYouthProfileNote,
  handleDeleteYouthProfileNote,
  handleGetYouthCohortAttendance,
  handleSetYouthCohortAttendance,
} from '../controllers/youthController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest, asyncHandler } from '../middleware/routeMiddleware';
import {
  inviteYouthSchema,
  setYouthSchema,
  youthQuerySchema,
  youthSessionNotesSchema,
  youthCohortAttendanceSchema,
  setYouthCohortAttendanceSchema,
} from '../validation/youthSchemas';
import { createYouthProfileNoteSchema, deleteYouthProfileNoteSchema, updateYouthProfileNoteSchema, youthProfileNotesSchema } from '../validation/youthProfileNoteSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:youth_profiles'), generalLimiter, validateRequest(youthQuerySchema), asyncHandler(handleGetYouth));
router.get('/:id/session-notes', authenticateToken, requirePermission('read:youth_profiles'), requirePermission('read:attendance'), generalLimiter, validateRequest(youthSessionNotesSchema), asyncHandler(handleGetYouthSessionNotes));
router.get('/:id/cohorts/:cohortId/attendance', authenticateToken, requirePermission('read:youth_profiles'), requirePermission('read:attendance'), requirePermission('read:sessions'), generalLimiter, validateRequest(youthCohortAttendanceSchema), asyncHandler(handleGetYouthCohortAttendance));
router.put('/:id/cohorts/:cohortId/attendance', authenticateToken, requirePermission('read:youth_profiles'), requirePermission('write:attendance'), requirePermission('read:sessions'), generalLimiter, validateRequest(setYouthCohortAttendanceSchema), asyncHandler(handleSetYouthCohortAttendance));
router.get('/:id/notes', authenticateToken, requirePermission('read:youth_profiles'), generalLimiter, validateRequest(youthProfileNotesSchema), asyncHandler(handleGetYouthProfileNotes));
router.post('/:id/notes', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(createYouthProfileNoteSchema), asyncHandler(handleSetYouthProfileNote));
router.put('/:id/notes/:noteId', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(updateYouthProfileNoteSchema), asyncHandler(handleSetYouthProfileNote));
router.delete('/:id/notes/:noteId', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(deleteYouthProfileNoteSchema), asyncHandler(handleDeleteYouthProfileNote));
router.post('/', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(setYouthSchema), asyncHandler(handleSetYouth));
router.post('/:id/invite', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(inviteYouthSchema), asyncHandler(handleInviteYouth));

export default router;
