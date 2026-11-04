import { Router } from 'express';
import {
  handleCreateHomepageImage,
  handleDeleteHomepageImage,
  handleGetHomepageImageFile,
  handleGetManagedHomepage,
  handleGetPublicHomepageImages,
  handleGetPublicHomepagePrograms,
  handlePublicLead,
  handleReorderHomepageImages,
  handleUpdateHomepageImage,
} from '../controllers/homepageController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { uploadFile } from '../middleware/fileUpload';
import { generalLimiter, strictLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import {
  createHomepageImageSchema,
  homepageImageFileParamsSchema,
  homepageImageParamsSchema,
  reorderHomepageImagesSchema,
  updateHomepageImageSchema,
} from '../validation/homepageSchemas';
import { publicLeadSchema } from '../validation/publicSchemas';

export const publicHomepageRoutes = Router();

publicHomepageRoutes.get('/homepage/images', generalLimiter, asyncHandler(handleGetPublicHomepageImages));
publicHomepageRoutes.get('/homepage/programs', generalLimiter, asyncHandler(handleGetPublicHomepagePrograms));
publicHomepageRoutes.get(
  '/homepage/images/:imageId/file',
  generalLimiter,
  validateRequest(homepageImageParamsSchema),
  asyncHandler(handleGetHomepageImageFile),
);
publicHomepageRoutes.get(
  '/homepage/images/:imageId/:variant',
  generalLimiter,
  validateRequest(homepageImageFileParamsSchema),
  asyncHandler(handleGetHomepageImageFile),
);
publicHomepageRoutes.post('/leads', strictLimiter, validateRequest(publicLeadSchema), asyncHandler(handlePublicLead));

const router = Router();

router.use(authenticateToken, requirePermission('read:homepage'), generalLimiter);

router.get('/', asyncHandler(handleGetManagedHomepage));
router.post(
  '/images',
  requirePermission('write:homepage'),
  uploadFile,
  validateRequest(createHomepageImageSchema),
  asyncHandler(handleCreateHomepageImage),
);
router.put(
  '/images/order',
  requirePermission('write:homepage'),
  validateRequest(reorderHomepageImagesSchema),
  asyncHandler(handleReorderHomepageImages),
);
router.put(
  '/images/:imageId',
  requirePermission('write:homepage'),
  validateRequest(updateHomepageImageSchema),
  asyncHandler(handleUpdateHomepageImage),
);
router.delete(
  '/images/:imageId',
  requirePermission('write:homepage'),
  validateRequest(homepageImageParamsSchema),
  asyncHandler(handleDeleteHomepageImage),
);
export default router;
