import { Router } from 'express';
import { handleExpressionOfInterest } from '../controllers/publicController';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { strictLimiter } from '../middleware/rateLimiter';
import { expressionOfInterestSchema } from '../validation/publicSchemas';

const router = Router();

router.post('/expressions-of-interest', strictLimiter, validateRequest(expressionOfInterestSchema), asyncHandler(handleExpressionOfInterest));

export default router;
