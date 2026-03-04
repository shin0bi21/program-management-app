import { Router } from 'express';
import { getStaff, createStaff } from '../controllers/staffController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { createStaffSchema } from '../validation/staffSchemas';

const router = Router();

// Get all staff/admin users
router.get('/', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, getStaff);

// Create a new staff user - admin only
router.post('/', authenticateToken, requirePermission('admin'), generalLimiter, validateRequest(createStaffSchema), createStaff);

export default router;
