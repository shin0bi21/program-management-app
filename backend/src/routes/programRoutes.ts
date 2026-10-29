import { Router } from 'express';
import { handleSetProgramCycles, handleCreateProgram, handleGetPrograms, handleUpdateProgram } from '../controllers/programController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { setProgramCyclesSchema, createProgramSchema, programQuerySchema, updateProgramSchema } from '../validation/programSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:programs'), generalLimiter, validateRequest(programQuerySchema), asyncHandler(handleGetPrograms));
router.post('/', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(createProgramSchema), asyncHandler(handleCreateProgram));
router.put('/:programId', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(updateProgramSchema), asyncHandler(handleUpdateProgram));

router.put('/:programId/cycles', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(setProgramCyclesSchema), asyncHandler(handleSetProgramCycles));

export default router;
