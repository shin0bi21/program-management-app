import { Router } from 'express';
import { handleCreateLead, handleGetLeads, handleUpdateLead, handleUpdateLeadStatus } from '../controllers/leadController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { createLeadSchema, leadQuerySchema, updateLeadSchema, updateLeadStatusSchema } from '../validation/leadSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:outreach'), generalLimiter, validateRequest(leadQuerySchema), asyncHandler(handleGetLeads));

router.post('/', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(createLeadSchema), asyncHandler(handleCreateLead));

router.put('/:id', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(updateLeadSchema), asyncHandler(handleUpdateLead));

router.patch('/:id/status', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(updateLeadStatusSchema), asyncHandler(handleUpdateLeadStatus));

export default router;
