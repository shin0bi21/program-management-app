import { Router } from 'express';
import {
  handleDeleteHours,
  handleGetHoursCalendarData,
  handleGetHoursTableData,
  handleGetHoursReferenceData,
  handleGetHoursDashboardData,
  handleGetHoursSessions,
  handleSetHours,
  handleUpdateHoursPlacement,
} from '../controllers/hoursController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import {
  setHoursSchema,
  hoursDashboardQuerySchema,
  hoursTableQuerySchema,
  hoursParamsSchema,
  hoursCalendarQuerySchema,
  hoursSessionQuerySchema,
  updateHoursPlacementSchema,
} from '../validation/hoursSchemas';

const router = Router();

router.get('/calendar', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursCalendarQuerySchema), asyncHandler(handleGetHoursCalendarData));
router.get('/table', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursTableQuerySchema), asyncHandler(handleGetHoursTableData));
router.get('/reference-data', authenticateToken, requirePermission('read:hours'), generalLimiter, asyncHandler(handleGetHoursReferenceData));
router.get('/dashboard', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursDashboardQuerySchema), asyncHandler(handleGetHoursDashboardData));
router.get('/sessions', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursSessionQuerySchema), asyncHandler(handleGetHoursSessions));
router.post('/', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(setHoursSchema), asyncHandler(handleSetHours));
router.put('/:id', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursParamsSchema), validateRequest(setHoursSchema), asyncHandler(handleSetHours));
router.patch('/:id/placement', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursParamsSchema), validateRequest(updateHoursPlacementSchema), asyncHandler(handleUpdateHoursPlacement));
router.delete('/:id', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursParamsSchema), asyncHandler(handleDeleteHours));

export default router;
