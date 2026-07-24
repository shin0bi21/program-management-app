import { Router } from 'express';
import { handleGetYouth, handleSetYouth, handleInviteYouth } from '../controllers/youthController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest, asyncHandler } from '../middleware/routeMiddleware';
import { inviteYouthSchema, setYouthSchema, youthQuerySchema } from '../validation/youthSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:youth_profiles'), generalLimiter, validateRequest(youthQuerySchema), asyncHandler(handleGetYouth));
router.post('/', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(setYouthSchema), asyncHandler(handleSetYouth));
router.post('/:id/invite', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(inviteYouthSchema), asyncHandler(handleInviteYouth));

export default router;
