import { Router } from 'express';
import { handleGetStaff, handleCreateStaff } from '../controllers/staffController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { asyncHandler } from '../middleware/errorHandler';
import { createStaffSchema } from '../validation/staffSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, asyncHandler(handleGetStaff));
router.post('/', authenticateToken, requirePermission('admin'), generalLimiter, validateRequest(createStaffSchema), asyncHandler(handleCreateStaff));

export default router;
