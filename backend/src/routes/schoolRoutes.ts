import { Router } from 'express';
import { handleGetSchools } from '../controllers/schoolController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// Get schools list
router.get('/', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, handleGetSchools);

export default router;
