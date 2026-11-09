import { Router } from 'express';
import { handleCreateSession } from '../controllers/sessionController';
import { handleSetProgramCycles, handleCreateProgram, handleGetPrograms, handleGetProgramList, handleUpdateProgram } from '../controllers/programController';
import { handleGetProgramCycles, handleGetProgramRosterYouth, handleGetProgramCycleAttendance, handleGetAttendanceReportPdf } from '../controllers/programCycleController';
import { handleEnrollYouth, handleWithdrawYouth } from '../controllers/enrollmentController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { setProgramCyclesSchema, createProgramSchema, programQuerySchema, programListQuerySchema, updateProgramSchema } from '../validation/programSchemas';
import { createSessionSchema, programCycleQuerySchema, programRosterSchema, programCycleAttendanceSchema, attendanceReportSchema, enrollYouthSchema, withdrawYouthSchema } from '../validation/programmingSchemas';

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
router.get('/:programId/cycles/:cycleId/attendance', authenticateToken, requirePermission('read:programs', 'read:attendance', 'read:sessions'), generalLimiter, validateRequest(programCycleAttendanceSchema), asyncHandler(handleGetProgramCycleAttendance));
router.post('/:programId/cycles/:cycleId/reports/youth.pdf', authenticateToken, requirePermission('read:programs', 'read:attendance', 'read:sessions'), generalLimiter, validateRequest(attendanceReportSchema), asyncHandler(handleGetAttendanceReportPdf));

router.post('/:programId/cycles/:cycleId/sessions', authenticateToken, requirePermission('write:sessions'), generalLimiter, validateRequest(createSessionSchema), asyncHandler(handleCreateSession));

export default router;
