import { Router } from 'express';
import { handleGetProgramCycles, handleSetProgramCycle, handleDeleteProgramCycle } from '../controllers/cycleController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { createCycleSchema, updateCycleSchema, deleteCycleSchema } from '../validation/cohortSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:programs'), generalLimiter, asyncHandler(handleGetProgramCycles));
router.post('/', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(createCycleSchema), asyncHandler(handleSetProgramCycle));
router.put('/:cycleId', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(updateCycleSchema), asyncHandler(handleSetProgramCycle));
router.delete('/:cycleId', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(deleteCycleSchema), asyncHandler(handleDeleteProgramCycle));

export default router;
