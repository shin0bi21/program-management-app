import { Router } from 'express';
import {
  handleGetHomepageImageFile,
  handleGetPublicHomepageImages,
  handleGetPublicHomepagePrograms,
} from '../controllers/homepageController';
import { handlePublicLead } from '../controllers/publicController';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { generalLimiter, strictLimiter } from '../middleware/rateLimiter';
import { publicLeadSchema } from '../validation/publicSchemas';
import { homepageImageFileParamsSchema, homepageImageParamsSchema } from '../validation/homepageSchemas';

const router = Router();

router.get('/homepage/images', generalLimiter, asyncHandler(handleGetPublicHomepageImages));
router.get('/homepage/programs', generalLimiter, asyncHandler(handleGetPublicHomepagePrograms));
router.get(
  '/homepage/images/:imageId/file',
  generalLimiter,
  validateRequest(homepageImageParamsSchema),
  asyncHandler(handleGetHomepageImageFile),
);
router.get(
  '/homepage/images/:imageId/:variant',
  generalLimiter,
  validateRequest(homepageImageFileParamsSchema),
  asyncHandler(handleGetHomepageImageFile),
);
router.post('/leads', strictLimiter, validateRequest(publicLeadSchema), asyncHandler(handlePublicLead));

export default router;
