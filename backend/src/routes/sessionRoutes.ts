import { Router } from 'express';
import { handleMoveSessionDate, handleCreateProgramSession, handleGetSessionList, handleGetSessionReferenceData, handleGetSessionTypes, handleCreateSession, handleGenerateSessions, handleGetSessionRoster, handleSetSessionAttendance, handleGetSessionNotes, handleCreateSessionNote, handleUpdateSessionNote, handleUnlinkSessionNoteYouth, handleDeleteSessionNote, handleGetSessionAttachments, handleCreateSessionAttachment, handleGetSessionAttachmentFile, handleUpdateSessionAttachment, handleDeleteSessionAttachment, handleUpdateSession, handleDeleteSession } from '../controllers/sessionController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { moveSessionDateSchema, createProgramSessionSchema, sessionListQuerySchema, createSessionSchema, generateSessionsSchema, saveAttendanceSchema, sessionNotesSchema, createSessionNoteSchema, updateSessionNoteSchema, unlinkSessionNoteYouthSchema, deleteSessionNoteSchema, sessionAttachmentsSchema, createSessionAttachmentSchema, sessionAttachmentParamsSchema, updateSessionAttachmentSchema, updateSessionSchema, deleteSessionSchema } from '../validation/cohortSchemas';
import { uploadFile } from '../middleware/fileUpload';

const router = Router();

router.get('/sessions', authenticateToken, requirePermission('read:sessions'), generalLimiter, validateRequest(sessionListQuerySchema), asyncHandler(handleGetSessionList));
router.get('/sessions/reference-data', authenticateToken, requirePermission('read:sessions'), generalLimiter, asyncHandler(handleGetSessionReferenceData));
router.get('/session-types', authenticateToken, requirePermission('read:sessions'), generalLimiter, asyncHandler(handleGetSessionTypes));
router.post('/sessions', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(createProgramSessionSchema), asyncHandler(handleCreateProgramSession));
router.post('/:cohortId/sessions', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(createSessionSchema), asyncHandler(handleCreateSession));
router.post('/:cohortId/sessions/generate', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(generateSessionsSchema), asyncHandler(handleGenerateSessions));
router.get('/sessions/:sessionId/roster', authenticateToken, requirePermission('read:attendance'), generalLimiter, asyncHandler(handleGetSessionRoster));
router.put('/sessions/:sessionId/attendance', authenticateToken, requirePermission('write:attendance'), generalLimiter, validateRequest(saveAttendanceSchema), asyncHandler(handleSetSessionAttendance));
router.get('/sessions/:sessionId/notes', authenticateToken, requirePermission('read:sessions'), generalLimiter, validateRequest(sessionNotesSchema), asyncHandler(handleGetSessionNotes));
router.post('/sessions/:sessionId/notes', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(createSessionNoteSchema), asyncHandler(handleCreateSessionNote));
router.put('/sessions/:sessionId/notes/:noteId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(updateSessionNoteSchema), asyncHandler(handleUpdateSessionNote));
router.delete('/sessions/:sessionId/notes/:noteId/youth/:youthId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(unlinkSessionNoteYouthSchema), asyncHandler(handleUnlinkSessionNoteYouth));
router.delete('/sessions/:sessionId/notes/:noteId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(deleteSessionNoteSchema), asyncHandler(handleDeleteSessionNote));
router.get('/sessions/:sessionId/attachments', authenticateToken, requirePermission('read:sessions'), generalLimiter, validateRequest(sessionAttachmentsSchema), asyncHandler(handleGetSessionAttachments));
router.post('/sessions/:sessionId/attachments', authenticateToken, requirePermission('write:sessions'), generalLimiter, uploadFile, validateRequest(createSessionAttachmentSchema), asyncHandler(handleCreateSessionAttachment));
router.get('/sessions/:sessionId/attachments/:attachmentId/file', authenticateToken, requirePermission('read:sessions'), generalLimiter, validateRequest(sessionAttachmentParamsSchema), asyncHandler(handleGetSessionAttachmentFile));
router.put('/sessions/:sessionId/attachments/:attachmentId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(updateSessionAttachmentSchema), asyncHandler(handleUpdateSessionAttachment));
router.delete('/sessions/:sessionId/attachments/:attachmentId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(sessionAttachmentParamsSchema), asyncHandler(handleDeleteSessionAttachment));
router.put('/sessions/:sessionId/date', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(moveSessionDateSchema), asyncHandler(handleMoveSessionDate));
router.put('/sessions/:sessionId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(updateSessionSchema), asyncHandler(handleUpdateSession));
router.delete('/sessions/:sessionId', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(deleteSessionSchema), asyncHandler(handleDeleteSession));

export default router;
