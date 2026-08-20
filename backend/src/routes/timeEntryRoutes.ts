import { Router } from 'express';
import {
  handleDeleteTimeEntry,
  handleGetTimeEntries,
  handleGetTimeEntryList,
  handleGetTimeEntryOptions,
  handleGetTimeEntryOverview,
  handleGetTimeEntrySessions,
  handleSetTimeEntry,
  handleUpdateTimeEntryPlacement,
} from '../controllers/timeEntryController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import {
  setTimeEntrySchema,
  timeEntryOverviewQuerySchema,
  timeEntryListQuerySchema,
  timeEntryParamsSchema,
  timeEntryQuerySchema,
  timeEntrySessionQuerySchema,
  updateTimeEntryPlacementSchema,
} from '../validation/timeEntrySchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(timeEntryQuerySchema), asyncHandler(handleGetTimeEntries));
router.get('/list', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(timeEntryListQuerySchema), asyncHandler(handleGetTimeEntryList));
router.get('/options', authenticateToken, requirePermission('read:hours'), generalLimiter, asyncHandler(handleGetTimeEntryOptions));
router.get('/overview', authenticateToken, requirePermission('read:hours'), generalLimiter, validateRequest(timeEntryOverviewQuerySchema), asyncHandler(handleGetTimeEntryOverview));
router.get('/sessions', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(timeEntrySessionQuerySchema), asyncHandler(handleGetTimeEntrySessions));
router.post('/', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(setTimeEntrySchema), asyncHandler(handleSetTimeEntry));
router.put('/:id', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(timeEntryParamsSchema), validateRequest(setTimeEntrySchema), asyncHandler(handleSetTimeEntry));
router.patch('/:id/placement', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(timeEntryParamsSchema), validateRequest(updateTimeEntryPlacementSchema), asyncHandler(handleUpdateTimeEntryPlacement));
router.delete('/:id', authenticateToken, requirePermission('write:hours'), generalLimiter, validateRequest(timeEntryParamsSchema), asyncHandler(handleDeleteTimeEntry));

export default router;
