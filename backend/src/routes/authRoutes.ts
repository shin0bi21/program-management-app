import { Router } from 'express';
import { login, forgotPassword, resetPassword, refreshToken, logout, verify2FA, resend2FA } from '../controllers/authController';
import { authLimiter, strictLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { 
  loginSchema, 
  verify2FASchema, 
  resend2FASchema, 
  forgotPasswordSchema, 
  resetPasswordSchema 
} from '../validation/authSchemas';

const router = Router();

router.post('/login', authLimiter, validateRequest(loginSchema), login);
router.post('/verify', strictLimiter, validateRequest(verify2FASchema), verify2FA);
router.post('/resend', strictLimiter, validateRequest(resend2FASchema), resend2FA);
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', logout); // No auth required - just clears cookie
router.post('/forgot-password', passwordResetLimiter, validateRequest(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validateRequest(resetPasswordSchema), resetPassword);

export default router;
