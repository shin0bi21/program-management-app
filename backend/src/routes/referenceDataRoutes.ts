import { Router } from 'express';
import { authenticateToken, requireAnyPermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { handleGetCycleReferenceData, handleGetProgramReferenceData, handleGetSchoolReferenceData, handleGetStaffReferenceData } from '../controllers/referenceDataController';
import { programReferenceDataSchema, staffReferenceDataSchema } from '../validation/referenceDataSchemas';

const router = Router();
const requireLookupPermission = requireAnyPermission(
  'read:programs', 'write:programs', 'read:sessions', 'read:tasks', 'read:hours',
  'read:youth_profiles', 'read:outreach', 'read:accounts',
);

router.get('/cycles', authenticateToken, requireLookupPermission, generalLimiter, asyncHandler(handleGetCycleReferenceData));
// Assigned labels serve My Account; the service checks capability only for unrestricted labels.
router.get('/programs', authenticateToken, generalLimiter, validateRequest(programReferenceDataSchema), asyncHandler(handleGetProgramReferenceData));
router.get('/staff', authenticateToken, requireAnyPermission('read:tasks', 'read:hours'), generalLimiter, validateRequest(staffReferenceDataSchema), asyncHandler(handleGetStaffReferenceData));
router.get('/schools', authenticateToken, requireAnyPermission('read:schools', 'write:schools', 'read:youth_profiles'), generalLimiter, asyncHandler(handleGetSchoolReferenceData));

export default router;
