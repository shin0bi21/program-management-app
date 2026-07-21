import { Router } from 'express';
import { handleCreateLead, handleGetLeads, handleUpdateLeadStatus } from '../controllers/leadController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { createLeadSchema, leadQuerySchema, updateLeadStatusSchema } from '../validation/leadSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:outreach'), generalLimiter, validateRequest(leadQuerySchema), asyncHandler(handleGetLeads));

router.post('/', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(createLeadSchema), asyncHandler(handleCreateLead));

router.patch('/:id/status', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(updateLeadStatusSchema), asyncHandler(handleUpdateLeadStatus));

export default router;
