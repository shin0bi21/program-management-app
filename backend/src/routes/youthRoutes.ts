import { Router } from 'express';
import { handleGetYouth, handleSetYouth } from '../controllers/youthController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest, asyncHandler } from '../middleware/routeMiddleware';
import { setYouthSchema } from '../validation/youthSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:youth'), generalLimiter, asyncHandler(handleGetYouth));
router.post('/', authenticateToken, requirePermission('write:youth'), generalLimiter, validateRequest(setYouthSchema), asyncHandler(handleSetYouth));

export default router;
