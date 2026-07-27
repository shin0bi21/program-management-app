import { Router } from 'express';
import {
  handleGetYouth,
  handleGetYouthSessionNotes,
  handleInviteYouth,
  handleSetYouth,
} from '../controllers/youthController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { validateRequest, asyncHandler } from '../middleware/routeMiddleware';
import {
  inviteYouthSchema,
  setYouthSchema,
  youthQuerySchema,
  youthSessionNotesSchema,
} from '../validation/youthSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:youth_profiles'), generalLimiter, validateRequest(youthQuerySchema), asyncHandler(handleGetYouth));
router.get('/:id/session-notes', authenticateToken, requirePermission('read:youth_profiles'), requirePermission('read:attendance'), generalLimiter, validateRequest(youthSessionNotesSchema), asyncHandler(handleGetYouthSessionNotes));
router.post('/', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(setYouthSchema), asyncHandler(handleSetYouth));
router.post('/:id/invite', authenticateToken, requirePermission('write:youth_profiles'), generalLimiter, validateRequest(inviteYouthSchema), asyncHandler(handleInviteYouth));

export default router;
