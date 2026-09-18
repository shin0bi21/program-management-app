import { Router } from 'express';
import {
  handleCreateHomepageImage,
  handleDeleteHomepageImage,
  handleGetManagedHomepage,
  handleReorderHomepageImages,
  handleUpdateHomepageImage,
} from '../controllers/homepageController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { uploadFile } from '../middleware/fileUpload';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import {
  createHomepageImageSchema,
  homepageImageParamsSchema,
  reorderHomepageImagesSchema,
  updateHomepageImageSchema,
} from '../validation/homepageSchemas';

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
