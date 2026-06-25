import { Router } from 'express';
import { handleCohortInterest } from '../controllers/publicController';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { strictLimiter } from '../middleware/rateLimiter';
import { cohortInterestSchema } from '../validation/publicSchemas';

const router = Router();

router.post('/cohort-interest', strictLimiter, validateRequest(cohortInterestSchema), asyncHandler(handleCohortInterest));

export default router;
