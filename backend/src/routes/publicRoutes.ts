import { Router } from 'express';
import { handleGetHomepageImageFile, handleGetPublicHomepage } from '../controllers/homepageController';
import { handleExpressionOfInterest } from '../controllers/publicController';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { generalLimiter, strictLimiter } from '../middleware/rateLimiter';
import { expressionOfInterestSchema } from '../validation/publicSchemas';
import { homepageImageParamsSchema } from '../validation/homepageSchemas';

const router = Router();

router.get('/homepage', generalLimiter, asyncHandler(handleGetPublicHomepage));
router.get(
  '/homepage/images/:imageId/file',
  generalLimiter,
  validateRequest(homepageImageParamsSchema),
  asyncHandler(handleGetHomepageImageFile),
);
router.post('/expressions-of-interest', strictLimiter, validateRequest(expressionOfInterestSchema), asyncHandler(handleExpressionOfInterest));

export default router;
