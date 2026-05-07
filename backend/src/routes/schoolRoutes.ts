import { Router } from 'express';
import { handleGetSchools } from '../controllers/schoolController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:schools'), generalLimiter, asyncHandler(handleGetSchools));

export default router;
