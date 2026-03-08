import { Router } from 'express';
import { handleGetYouth, handleSetYouth } from '../controllers/youthController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { setYouthSchema } from '../validation/youthSchemas';

const router = Router();

// Get youth profiles (all, or single by ?id=)
router.get('/', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, handleGetYouth);

// Create or update a youth profile
router.post('/', authenticateToken, requirePermission('admin', 'staff'), generalLimiter, validateRequest(setYouthSchema), handleSetYouth);

export default router;
