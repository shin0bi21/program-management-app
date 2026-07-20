import { Router } from 'express';
import { handleConvertCohortInterestSubmission, handleGetCohortInterestSubmissions, handleUpdateCohortInterestStatus } from '../controllers/cohortInterestController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { cohortInterestIdSchema, updateCohortInterestStatusSchema } from '../validation/cohortInterestSchemas';

const router = Router();

router.get('/',
  authenticateToken,
  requirePermission('read:outreach'),
  generalLimiter,
  asyncHandler(handleGetCohortInterestSubmissions),
);

router.patch('/:id',
  authenticateToken,
  requirePermission('write:outreach'),
  generalLimiter,
  validateRequest(updateCohortInterestStatusSchema),
  asyncHandler(handleUpdateCohortInterestStatus),
);

router.post('/:id/convert',
  authenticateToken,
  requirePermission('write:outreach'),
  generalLimiter,
  validateRequest(cohortInterestIdSchema),
  asyncHandler(handleConvertCohortInterestSubmission),
);

export default router;
