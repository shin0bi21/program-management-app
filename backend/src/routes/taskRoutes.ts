import { Router } from 'express';
import { handleDeleteTask, handleGetTask, handleGetOpenTasks, handleGetTaskList, handleGetTaskReferenceData, handleGetTasksCalendarData, handleSetTask, handleUpdateTaskPlacement, handleUpdateTaskState } from '../controllers/taskController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { setTaskSchema, updateTaskPlacementSchema, updateTaskStateSchema, taskCalendarQuerySchema, taskListQuerySchema, taskParamsSchema, openTaskQuerySchema } from '../validation/taskSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:tasks'), generalLimiter, validateRequest(openTaskQuerySchema), asyncHandler(handleGetOpenTasks));
router.get('/calendar', authenticateToken, requirePermission('read:tasks'), generalLimiter, validateRequest(taskCalendarQuerySchema), asyncHandler(handleGetTasksCalendarData));
router.get('/list', authenticateToken, requirePermission('read:tasks'), generalLimiter, validateRequest(taskListQuerySchema), asyncHandler(handleGetTaskList));
router.get('/reference-data', authenticateToken, requirePermission('read:tasks'), generalLimiter, asyncHandler(handleGetTaskReferenceData));
router.get('/:id', authenticateToken, requirePermission('read:tasks'), generalLimiter, validateRequest(taskParamsSchema), asyncHandler(handleGetTask));
router.post('/', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(setTaskSchema), asyncHandler(handleSetTask));
router.put('/:id', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(taskParamsSchema), validateRequest(setTaskSchema), asyncHandler(handleSetTask));
router.patch('/:id/placement', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(taskParamsSchema), validateRequest(updateTaskPlacementSchema), asyncHandler(handleUpdateTaskPlacement));
router.patch('/:id/state', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(taskParamsSchema), validateRequest(updateTaskStateSchema), asyncHandler(handleUpdateTaskState));
router.delete('/:id', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(taskParamsSchema), asyncHandler(handleDeleteTask));

export default router;
