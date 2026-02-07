import { Router } from 'express';
import { getUsers, createUser } from '../controllers/userController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { createUserSchema } from '../validation/userSchemas';

const router = Router();

// Get users - admin/staff only
router.get('/', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, getUsers);
router.get('/all', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, getUsers);

// Create user - admin only
router.post('/', authenticateToken, requirePermission('admin'), generalLimiter, validateRequest(createUserSchema), createUser);

export default router;
