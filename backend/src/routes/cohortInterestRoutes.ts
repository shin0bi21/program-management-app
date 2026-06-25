import { Router } from 'express';
import { handleGetCohortInterestSubmissions, handleUpdateCohortInterestStatus } from '../controllers/cohortInterestController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { updateCohortInterestStatusSchema } from '../validation/cohortInterestSchemas';

const router = Router();

router.get('/',
  authenticateToken,
  requirePermission('read:settings'),
  generalLimiter,
  asyncHandler(handleGetCohortInterestSubmissions),
);

router.patch('/:id',
  authenticateToken,
  requirePermission('write:settings'),
  generalLimiter,
  validateRequest(updateCohortInterestStatusSchema),
  asyncHandler(handleUpdateCohortInterestStatus),
);

export default router;
