import { Router } from 'express';
import {
  handleGetAccounts,
  handleRevokeAccountInvite,
  handleSetAccount,
  handleToggleAccountStatus,
} from '../controllers/accountController';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { generalLimiter } from '../middleware/rateLimiter';
import { asyncHandler, validateRequest } from '../middleware/routeMiddleware';
import { accountQuerySchema, setAccountSchema } from '../validation/accountSchemas';

const router = Router();

router.get('/', authenticateToken, requirePermission('read:accounts'), generalLimiter, validateRequest(accountQuerySchema), asyncHandler(handleGetAccounts));
router.post('/', authenticateToken, requirePermission('write:accounts'), generalLimiter, validateRequest(setAccountSchema), asyncHandler(handleSetAccount));
router.patch('/:id', authenticateToken, requirePermission('write:accounts'), generalLimiter, asyncHandler(handleToggleAccountStatus));
router.delete('/:id', authenticateToken, requirePermission('write:accounts'), generalLimiter, asyncHandler(handleRevokeAccountInvite));

export default router;
