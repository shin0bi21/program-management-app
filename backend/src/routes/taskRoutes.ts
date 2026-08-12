import { Router } from 'express';
import { handleCreateTask, handleDeleteTask, handleGetTaskList, handleGetTaskOptions, handleGetTasks, handleUpdateTask, handleUpdateTaskPlacement, handleUpdateTaskStatus } from '../controllers/taskController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { setTaskSchema, updateTaskPlacementSchema, updateTaskStatusSchema, taskListQuerySchema, taskParamsSchema, taskQuerySchema } from '../validation/taskSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:tasks'), generalLimiter, validateRequest(taskQuerySchema), asyncHandler(handleGetTasks));
router.get('/list', authenticateToken, requirePermission('read:tasks'), generalLimiter, validateRequest(taskListQuerySchema), asyncHandler(handleGetTaskList));
router.get('/options', authenticateToken, requirePermission('read:tasks'), generalLimiter, asyncHandler(handleGetTaskOptions));
router.post('/', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(setTaskSchema), asyncHandler(handleCreateTask));
router.put('/:id', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(taskParamsSchema), validateRequest(setTaskSchema), asyncHandler(handleUpdateTask));
router.patch('/:id/placement', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(taskParamsSchema), validateRequest(updateTaskPlacementSchema), asyncHandler(handleUpdateTaskPlacement));
router.patch('/:id/status', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(taskParamsSchema), validateRequest(updateTaskStatusSchema), asyncHandler(handleUpdateTaskStatus));
router.delete('/:id', authenticateToken, requirePermission('write:tasks'), generalLimiter, validateRequest(taskParamsSchema), asyncHandler(handleDeleteTask));

export default router;
