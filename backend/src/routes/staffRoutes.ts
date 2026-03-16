import { Router } from 'express';
import { handleGetStaff, handleCreateStaff } from '../controllers/staffController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { createStaffSchema } from '../validation/staffSchemas';

const router = Router();

// Get all staff/admin users
router.get('/', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, handleGetStaff);

// Create a new staff user - admin only
router.post('/', authenticateToken, requirePermission('admin'), generalLimiter, validateRequest(createStaffSchema), handleCreateStaff);

export default router;
