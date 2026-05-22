import { Router } from 'express';
import { handleGetYouth, handleSetYouth, handleToggleYouthActive } from '../controllers/youthController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest, asyncHandler } from '../middleware/routeMiddleware';
import { setYouthSchema } from '../validation/youthSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:youth_profiles'), generalLimiter, asyncHandler(handleGetYouth));
router.post('/', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(setYouthSchema), asyncHandler(handleSetYouth));
router.patch('/:id', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, asyncHandler(handleToggleYouthActive));

export default router;
