import { Router } from 'express';
import {
  handleCreateTimeEntry,
  handleDeleteTimeEntry,
  handleGetTimeEntries,
  handleGetTimeEntryCohorts,
  handleGetTimeEntryOverview,
  handleUpdateTimeEntry,
  handleUpdateTimeEntryPlacement,
} from '../controllers/timeEntryController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import {
  setTimeEntrySchema,
  timeEntryCohortQuerySchema,
  timeEntryOverviewQuerySchema,
  timeEntryParamsSchema,
  timeEntryQuerySchema,
  updateTimeEntryPlacementSchema,
} from '../validation/timeEntrySchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:timesheets'), generalLimiter, validateRequest(timeEntryQuerySchema), asyncHandler(handleGetTimeEntries));
router.get('/cohorts', authenticateToken, requirePermission('read:timesheets'), generalLimiter, validateRequest(timeEntryCohortQuerySchema), asyncHandler(handleGetTimeEntryCohorts));
router.get('/overview', authenticateToken, requirePermission('read:timesheets'), generalLimiter, validateRequest(timeEntryOverviewQuerySchema), asyncHandler(handleGetTimeEntryOverview));
router.post('/', authenticateToken, requirePermission('write:timesheets'), generalLimiter, validateRequest(setTimeEntrySchema), asyncHandler(handleCreateTimeEntry));
router.put('/:id', authenticateToken, requirePermission('write:timesheets'), generalLimiter, validateRequest(timeEntryParamsSchema), validateRequest(setTimeEntrySchema), asyncHandler(handleUpdateTimeEntry));
router.patch('/:id/placement', authenticateToken, requirePermission('write:timesheets'), generalLimiter, validateRequest(timeEntryParamsSchema), validateRequest(updateTimeEntryPlacementSchema), asyncHandler(handleUpdateTimeEntryPlacement));
router.delete('/:id', authenticateToken, requirePermission('write:timesheets'), generalLimiter, validateRequest(timeEntryParamsSchema), asyncHandler(handleDeleteTimeEntry));

export default router;
