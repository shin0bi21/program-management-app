import { Router } from 'express';
import {
  handleDeleteHours,
  handleGetHours,
  handleGetHoursList,
  handleGetHoursOptions,
  handleGetHoursOverview,
  handleGetHoursSessions,
  handleSetHours,
  handleUpdateHoursPlacement,
} from '../controllers/hoursController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import {
  setHoursSchema,
  hoursOverviewQuerySchema,
  hoursListQuerySchema,
  hoursParamsSchema,
  hoursQuerySchema,
  hoursSessionQuerySchema,
  updateHoursPlacementSchema,
} from '../validation/hoursSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursQuerySchema), asyncHandler(handleGetHours));
router.get('/list', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursListQuerySchema), asyncHandler(handleGetHoursList));
router.get('/options', authenticateToken, requirePermission('read:hours'), generalLimiter, asyncHandler(handleGetHoursOptions));
router.get('/overview', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursOverviewQuerySchema), asyncHandler(handleGetHoursOverview));
router.get('/sessions', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursSessionQuerySchema), asyncHandler(handleGetHoursSessions));
router.post('/', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(setHoursSchema), asyncHandler(handleSetHours));
router.put('/:id', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursParamsSchema), validateRequest(setHoursSchema), asyncHandler(handleSetHours));
router.patch('/:id/placement', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursParamsSchema), validateRequest(updateHoursPlacementSchema), asyncHandler(handleUpdateHoursPlacement));
router.delete('/:id', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursParamsSchema), asyncHandler(handleDeleteHours));

export default router;
