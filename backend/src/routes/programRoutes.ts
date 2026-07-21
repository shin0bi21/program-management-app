import { Router } from 'express';
import { handleCreateProgram, handleGetPrograms } from '../controllers/programController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { createProgramSchema } from '../validation/programSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:programs'), generalLimiter, asyncHandler(handleGetPrograms));
router.post('/', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(createProgramSchema), asyncHandler(handleCreateProgram));

export default router;
