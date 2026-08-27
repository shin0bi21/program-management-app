import { Router } from 'express';
import { handleCreateLead, handleDeleteLead, handleDeleteLeadNote, handleGetLeadNotes, handleGetLeads, handleSetLeadNote, handleSignUpLead, handleUpdateLead, handleUpdateLeadNote, handleUpdateLeadStatus } from '../controllers/leadController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { createLeadSchema, leadIdSchema, leadQuerySchema, signUpLeadSchema, updateLeadSchema, updateLeadStatusSchema } from '../validation/leadSchemas';
import { createLeadNoteSchema, deleteLeadNoteSchema, leadNotesSchema, updateLeadNoteSchema } from '../validation/leadNoteSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:outreach'), generalLimiter, validateRequest(leadQuerySchema), asyncHandler(handleGetLeads));

router.post('/', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(createLeadSchema), asyncHandler(handleCreateLead));

router.put('/:id', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(updateLeadSchema), asyncHandler(handleUpdateLead));

router.patch('/:id/status', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(updateLeadStatusSchema), asyncHandler(handleUpdateLeadStatus));

router.get('/:id/notes', authenticateToken, requirePermission('read:outreach'), generalLimiter, validateRequest(leadNotesSchema), asyncHandler(handleGetLeadNotes));

router.post('/:id/notes', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(createLeadNoteSchema), asyncHandler(handleSetLeadNote));

router.put('/:id/notes/:noteId', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(updateLeadNoteSchema), asyncHandler(handleUpdateLeadNote));

router.delete('/:id/notes/:noteId', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(deleteLeadNoteSchema), asyncHandler(handleDeleteLeadNote));

router.post('/:id/sign-up', authenticateToken, requirePermission('write:outreach'), requirePermission('write:youth_profiles'), requirePermission('write:cohorts'), generalLimiter, validateRequest(signUpLeadSchema), asyncHandler(handleSignUpLead));

router.delete('/:id', authenticateToken, requirePermission('write:outreach'), generalLimiter, validateRequest(leadIdSchema), asyncHandler(handleDeleteLead));

export default router;
