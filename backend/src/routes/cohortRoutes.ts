import { Router } from 'express';
import { handleGetCohorts, handleGetCohortRosterYouth, handleGetCohortYouthReport, handleGetCohortYouthReportPdf, handleCreateCohort, handleUpdateCohort, handleDeleteCohort } from '../controllers/cohortController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { cohortQuerySchema, cohortRosterSchema, cohortYouthReportSchema, createCohortSchema, updateCohortSchema, deleteCohortSchema } from '../validation/cohortSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:programs'), generalLimiter, validateRequest(cohortQuerySchema), asyncHandler(handleGetCohorts));
router.get('/:cohortId/roster', authenticateToken, requirePermission('read:programs', 'read:youth_profiles'), generalLimiter, validateRequest(cohortRosterSchema), asyncHandler(handleGetCohortRosterYouth));
router.get('/:cohortId/reports/youth', authenticateToken, requirePermission('read:programs', 'read:attendance', 'read:sessions'), generalLimiter, validateRequest(cohortYouthReportSchema), asyncHandler(handleGetCohortYouthReport));
router.get('/:cohortId/reports/youth.pdf', authenticateToken, requirePermission('read:programs', 'read:attendance', 'read:sessions'), generalLimiter, validateRequest(cohortYouthReportSchema), asyncHandler(handleGetCohortYouthReportPdf));
router.post('/', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(createCohortSchema), asyncHandler(handleCreateCohort));
router.put('/:cohortId', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(updateCohortSchema), asyncHandler(handleUpdateCohort));
router.delete('/:cohortId', authenticateToken, requirePermission('write:programs'), generalLimiter, validateRequest(deleteCohortSchema), asyncHandler(handleDeleteCohort));

export default router;
