import { Router } from 'express';
import { handleEnrollYouth, handleWithdrawYouth } from '../controllers/enrollmentController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { enrollYouthSchema, withdrawYouthSchema } from '../validation/cohortSchemas';

const router = Router();

router.post('/:cohortId/enrollments', authenticateToken, requirePermission('write:enrollments'), generalLimiter, validateRequest(enrollYouthSchema), asyncHandler(handleEnrollYouth));
router.patch('/:cohortId/enrollments/:youthId/withdraw', authenticateToken, requirePermission('write:enrollments'), generalLimiter, validateRequest(withdrawYouthSchema), asyncHandler(handleWithdrawYouth));

export default router;
