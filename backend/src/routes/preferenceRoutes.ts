import { Router } from 'express';
import { handleGetPreference, handleSetPreference } from '../controllers/preferenceController';
import { authenticateToken } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { getPreferenceSchema, setPreferenceSchema } from '../validation/preferenceSchemas';

const router = Router();

router.get('/:preferenceKey', authenticateToken, generalLimiter, validateRequest(getPreferenceSchema), asyncHandler(handleGetPreference));
router.put('/:preferenceKey', authenticateToken, generalLimiter, validateRequest(setPreferenceSchema), asyncHandler(handleSetPreference));

export default router;
