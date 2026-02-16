import { Router } from 'express';
import { getStaff, createStaff, getYouth, setYouth } from '../controllers/userController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { createStaffSchema, setYouthSchema } from '../validation/userSchemas';

const router = Router();

// Get staff/admin users
router.get('/staff', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, getStaff);

// Get youth profiles
router.get('/youth', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, getYouth);

// Create staff - admin only
router.post('/staff', authenticateToken, requirePermission('admin'), generalLimiter, validateRequest(createStaffSchema), createStaff);

// Create/Update youth - admin/staff
router.post('/youth', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, validateRequest(setYouthSchema), setYouth);

export default router;
