import { Router } from 'express';
import { handleCreateSession, handleGenerateSessions } from '../controllers/sessionController';
import { handleSetProgramCycles, handleCreateProgram, handleGetPrograms, handleGetProgramList, handleUpdateProgram } from '../controllers/programController';
import { handleGetProgramCycles, handleGetProgramRosterYouth, handleGetProgramCycleYouthReport, handleGetProgramCycleYouthReportPdf } from '../controllers/programCycleController';
import { handleEnrollYouth, handleWithdrawYouth } from '../controllers/enrollmentController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { setProgramCyclesSchema, createProgramSchema, programQuerySchema, programListQuerySchema, updateProgramSchema } from '../validation/programSchemas';
import { createSessionSchema, generateSessionsSchema, programCycleQuerySchema, programRosterSchema, programCycleYouthReportSchema, enrollYouthSchema, withdrawYouthSchema } from '../validation/programmingSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:programs'), generalLimiter, validateRequest(programQuerySchema), asyncHandler(handleGetPrograms));
router.get('/list', authenticateToken, requirePermission('read:programs'), generalLimiter, validateRequest(programListQuerySchema), asyncHandler(handleGetProgramList));
router.get('/cycle-assignments', authenticateToken, requirePermission('read:programs'), generalLimiter, validateRequest(programCycleQuerySchema), asyncHandler(handleGetProgramCycles));
router.post('/', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(createProgramSchema), asyncHandler(handleCreateProgram));
router.put('/:programId', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(updateProgramSchema), asyncHandler(handleUpdateProgram));

router.put('/:programId/cycles', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(setProgramCyclesSchema), asyncHandler(handleSetProgramCycles));
router.get('/:programId/cycles/:cycleId/roster', authenticateToken, requirePermission('read:programs', 'read:youth_profiles'), generalLimiter, validateRequest(programRosterSchema), asyncHandler(handleGetProgramRosterYouth));
router.post('/:programId/cycles/:cycleId/enrollments', authenticateToken, requirePermission('write:enrollments'), generalLimiter, validateRequest(enrollYouthSchema), asyncHandler(handleEnrollYouth));
router.patch('/:programId/cycles/:cycleId/enrollments/:youthId/withdraw', authenticateToken, requirePermission('write:enrollments'), generalLimiter, validateRequest(withdrawYouthSchema), asyncHandler(handleWithdrawYouth));
router.get('/:programId/cycles/:cycleId/reports/youth', authenticateToken, requirePermission('read:programs', 'read:attendance', 'read:sessions'), generalLimiter, validateRequest(programCycleYouthReportSchema), asyncHandler(handleGetProgramCycleYouthReport));
router.get('/:programId/cycles/:cycleId/reports/youth.pdf', authenticateToken, requirePermission('read:programs', 'read:attendance', 'read:sessions'), generalLimiter, validateRequest(programCycleYouthReportSchema), asyncHandler(handleGetProgramCycleYouthReportPdf));

router.post('/:programId/cycles/:cycleId/sessions', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(createSessionSchema), asyncHandler(handleCreateSession));
router.post('/:programId/cycles/:cycleId/sessions/generate', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(generateSessionsSchema), asyncHandler(handleGenerateSessions));

export default router;
