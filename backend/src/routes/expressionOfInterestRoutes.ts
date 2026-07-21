import { Router } from 'express';
import { handleConvertExpressionOfInterest, handleGetExpressionsOfInterest, handleUpdateExpressionOfInterestStatus } from '../controllers/expressionOfInterestController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { expressionOfInterestIdSchema, expressionOfInterestQuerySchema, updateExpressionOfInterestStatusSchema } from '../validation/expressionOfInterestSchemas';

const router = Router();

router.get('/',
  authenticateToken,
  requirePermission('read:outreach'),
  generalLimiter,
  validateRequest(expressionOfInterestQuerySchema),
  asyncHandler(handleGetExpressionsOfInterest),
);

router.patch('/:id',
  authenticateToken,
  requirePermission('write:outreach'),
  generalLimiter,
  validateRequest(updateExpressionOfInterestStatusSchema),
  asyncHandler(handleUpdateExpressionOfInterestStatus),
);

router.post('/:id/convert',
  authenticateToken,
  requirePermission('write:outreach'),
  generalLimiter,
  validateRequest(expressionOfInterestIdSchema),
  asyncHandler(handleConvertExpressionOfInterest),
);

export default router;
