import { Router } from 'express';
import {
  handleDeleteHours,
  handleGetHoursCalendarData,
  handleGetHoursTableData,
  handleGetHoursReferenceData,
  handleGetHoursPayPeriodData,
  handleGetHoursCycleSummaryData,
  handleGetHoursSessions,
  handleSetHours,
} from '../controllers/hoursController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import {
  createHoursSchema,
  editHoursSchema,
  hoursPayPeriodQuerySchema,
  hoursCycleSummaryQuerySchema,
  hoursTableQuerySchema,
  hoursParamsSchema,
  hoursCalendarQuerySchema,
  hoursSessionQuerySchema,
} from '../validation/hoursSchemas';

const router = Router();

router.get('/calendar', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursCalendarQuerySchema), asyncHandler(handleGetHoursCalendarData));
router.get('/table', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursTableQuerySchema), asyncHandler(handleGetHoursTableData));
router.get('/reference-data', authenticateToken, requirePermission('read:hours'), generalLimiter, asyncHandler(handleGetHoursReferenceData));
router.get('/pay-period', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursPayPeriodQuerySchema), asyncHandler(handleGetHoursPayPeriodData));
router.get('/cycle-summary', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(hoursCycleSummaryQuerySchema), asyncHandler(handleGetHoursCycleSummaryData));
router.get('/sessions', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursSessionQuerySchema), asyncHandler(handleGetHoursSessions));
router.post('/', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(createHoursSchema), asyncHandler(handleSetHours));
router.patch('/:id', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(editHoursSchema), asyncHandler(handleSetHours));
router.delete('/:id', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(hoursParamsSchema), asyncHandler(handleDeleteHours));

export default router;
