import { Router } from 'express';
import { handleGetStaff, handleSetStaff, handleDeleteStaff, handleToggleStaffStatus } from '../controllers/staffController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest, asyncHandler } from '../middleware/routeMiddleware';
import { setStaffSchema } from '../validation/staffSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:staff'), generalLimiter, asyncHandler(handleGetStaff));
router.post('/', authenticateToken, requirePermission('write:staff'), generalLimiter, validateRequest(setStaffSchema), asyncHandler(handleSetStaff));
router.patch('/:id', authenticateToken, requirePermission('write:staff'), generalLimiter, asyncHandler(handleToggleStaffStatus));
router.delete('/:id', authenticateToken, requirePermission('write:staff'), generalLimiter, asyncHandler(handleDeleteStaff));

export default router;
