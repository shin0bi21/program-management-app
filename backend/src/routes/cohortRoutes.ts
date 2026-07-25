import { Router } from 'express';
import {
  handleCreateCohort,
  handleDeleteCohort,
  handleDeleteSession,
  handleEnrollYouth,
  handleGenerateActivitySessions,
  handleGetCohorts,
  handleGetSessionRoster,
  handleGetSessionList,
  handleGetSessions,
  handleSaveAttendance,
  handleSyncYouthCohorts,
  handleUpdateCohort,
  handleUpdateSession,
  handleWithdrawYouth,
} from '../controllers/cohortController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import {
  cohortQuerySchema,
  createCohortSchema,
  deleteCohortSchema,
  deleteSessionSchema,
  enrollYouthSchema,
  generateActivitySessionsSchema,
  saveAttendanceSchema,
  sessionListQuerySchema,
  sessionQuerySchema,
  syncYouthCohortsSchema,
  updateCohortSchema,
  updateSessionSchema,
  withdrawYouthSchema,
} from '../validation/cohortSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:cohorts'), generalLimiter, validateRequest(cohortQuerySchema), asyncHandler(handleGetCohorts));
router.post('/', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(createCohortSchema), asyncHandler(handleCreateCohort));
router.put('/:cohortId', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(updateCohortSchema), asyncHandler(handleUpdateCohort));
router.delete('/:cohortId', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(deleteCohortSchema), asyncHandler(handleDeleteCohort));
router.get('/sessions', authenticateToken, requirePermission('read:attendance'), generalLimiter, validateRequest(sessionListQuerySchema), asyncHandler(handleGetSessionList));
router.put('/enrollments/:youthId', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(syncYouthCohortsSchema), asyncHandler(handleSyncYouthCohorts));
router.post('/:cohortId/enrollments', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(enrollYouthSchema), asyncHandler(handleEnrollYouth));
router.patch('/:cohortId/enrollments/:youthId/withdraw', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(withdrawYouthSchema), asyncHandler(handleWithdrawYouth));
router.post('/:cohortId/activities/generate', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(generateActivitySessionsSchema), asyncHandler(handleGenerateActivitySessions));
router.get('/sessions/calendar', authenticateToken, requirePermission('read:attendance'), generalLimiter, validateRequest(sessionQuerySchema), asyncHandler(handleGetSessions));
router.get('/sessions/:sessionId/roster', authenticateToken, requirePermission('read:attendance'), generalLimiter, asyncHandler(handleGetSessionRoster));
router.put('/sessions/:sessionId/attendance', authenticateToken, requirePermission('write:attendance'), generalLimiter, validateRequest(saveAttendanceSchema), asyncHandler(handleSaveAttendance));
router.put('/sessions/:sessionId', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(updateSessionSchema), asyncHandler(handleUpdateSession));
router.delete('/sessions/:sessionId', authenticateToken, requirePermission('write:cohorts'), generalLimiter, validateRequest(deleteSessionSchema), asyncHandler(handleDeleteSession));

export default router;
