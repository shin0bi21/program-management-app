import { Router } from 'express';
import { getSchools } from '../controllers/schoolController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// Get schools list
router.get('/', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, getSchools);

export default router;
