import { Router } from 'express';
import { handleGetSchools, handleSetSchool, handleDeleteSchool } from '../controllers/schoolController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { setSchoolSchema } from '../validation/schoolSchemas';

const router = Router();

router.get('/',
  authenticateToken,
  requirePermission('read:schools'),
  generalLimiter,
  asyncHandler(handleGetSchools)
);

router.post('/',
  authenticateToken,
  requirePermission('write:schools'),
  generalLimiter,
  validateRequest(setSchoolSchema),
  asyncHandler(handleSetSchool)
);

router.delete('/:id',
  authenticateToken,
  requirePermission('write:schools'),
  generalLimiter,
  asyncHandler(handleDeleteSchool)
);

export default router;
