import { Router } from 'express';
import {
  handleCreateCohort,
  handleCreateSessionNote,
  handleCreateSessionAttachment,
  handleDeleteSessionAttachment,
  handleDeleteSessionNote,
  handleDeleteCohort,
  handleDeleteSession,
  handleEnrollYouth,
  handleGenerateSessions,
  handleGetCohorts,
  handleGetSessionList,
  handleGetSessionAttachmentFile,
  handleGetSessionAttachments,
  handleGetSessionNotes,
  handleGetSessionRoster,
  handleGetSessionTypes,
  handleSaveAttendance,
  handleUpdateCohort,
  handleUpdateSessionNote,
  handleUnlinkSessionNoteYouth,
  handleUpdateSession,
  handleWithdrawYouth,
} from '../controllers/cohortController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import {
  cohortQuerySchema,
  createCohortSchema,
  createSessionNoteSchema,
  createSessionAttachmentSchema,
  deleteSessionNoteSchema,
  deleteCohortSchema,
  deleteSessionSchema,
  enrollYouthSchema,
  generateSessionsSchema,
  saveAttendanceSchema,
  sessionListQuerySchema,
  sessionAttachmentParamsSchema,
  sessionAttachmentsSchema,
  sessionNotesSchema,
  updateCohortSchema,
  updateSessionNoteSchema,
  updateSessionSchema,
  unlinkSessionNoteYouthSchema,
  withdrawYouthSchema,
} from '../validation/cohortSchemas';
import { uploadSessionAttachment } from '../middleware/sessionAttachmentUpload';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:cohorts'), generalLimiter, validateRequest(cohortQuerySchema), asyncHandler(handleGetCohorts));
router.post('/', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(createCohortSchema), asyncHandler(handleCreateCohort));
router.put('/:cohortId', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(updateCohortSchema), asyncHandler(handleUpdateCohort));
router.delete('/:cohortId', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(deleteCohortSchema), asyncHandler(handleDeleteCohort));
router.get('/sessions', authenticateToken, requirePermission('read:sessions'), generalLimiter, validateRequest(sessionListQuerySchema), asyncHandler(handleGetSessionList));
router.get('/session-types', authenticateToken, requirePermission('read:sessions'), generalLimiter, asyncHandler(handleGetSessionTypes));
router.post('/:cohortId/enrollments', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(enrollYouthSchema), asyncHandler(handleEnrollYouth));
router.patch('/:cohortId/enrollments/:youthId/withdraw', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(withdrawYouthSchema), asyncHandler(handleWithdrawYouth));
router.post('/:cohortId/sessions/generate', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(generateSessionsSchema), asyncHandler(handleGenerateSessions));
router.get('/sessions/:sessionId/roster', authenticateToken, requirePermission('read:attendance'), generalLimiter, asyncHandler(handleGetSessionRoster));
router.put('/sessions/:sessionId/attendance', authenticateToken, requirePermission('write:attendance'), generalLimiter, validateRequest(saveAttendanceSchema), asyncHandler(handleSaveAttendance));
router.get('/sessions/:sessionId/notes', authenticateToken, requirePermission('read:sessions'), generalLimiter, validateRequest(sessionNotesSchema), asyncHandler(handleGetSessionNotes));
router.post('/sessions/:sessionId/notes', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(createSessionNoteSchema), asyncHandler(handleCreateSessionNote));
router.put('/sessions/:sessionId/notes/:noteId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(updateSessionNoteSchema), asyncHandler(handleUpdateSessionNote));
router.delete('/sessions/:sessionId/notes/:noteId/youth/:youthId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(unlinkSessionNoteYouthSchema), asyncHandler(handleUnlinkSessionNoteYouth));
router.delete('/sessions/:sessionId/notes/:noteId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(deleteSessionNoteSchema), asyncHandler(handleDeleteSessionNote));
router.get('/sessions/:sessionId/attachments', authenticateToken, requirePermission('read:sessions'), generalLimiter, validateRequest(sessionAttachmentsSchema), asyncHandler(handleGetSessionAttachments));
router.post('/sessions/:sessionId/attachments', authenticateToken, requirePermission('write:sessions'), generalLimiter, uploadSessionAttachment, validateRequest(createSessionAttachmentSchema), asyncHandler(handleCreateSessionAttachment));
router.get('/sessions/:sessionId/attachments/:attachmentId/file', authenticateToken, requirePermission('read:sessions'), generalLimiter, validateRequest(sessionAttachmentParamsSchema), asyncHandler(handleGetSessionAttachmentFile));
router.delete('/sessions/:sessionId/attachments/:attachmentId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(sessionAttachmentParamsSchema), asyncHandler(handleDeleteSessionAttachment));
router.put('/sessions/:sessionId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(updateSessionSchema), asyncHandler(handleUpdateSession));
router.delete('/sessions/:sessionId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(deleteSessionSchema), asyncHandler(handleDeleteSession));

export default router;
