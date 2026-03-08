import { Router } from 'express';
import { handleLogin, handleForgotPassword, handleResetPassword, handleRefreshToken, handleLogout, handleVerify2FA, handleResend2FA } from '../controllers/authController';
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

router.post('/login', authLimiter, validateRequest(loginSchema), handleLogin);
router.post('/verify', strictLimiter, validateRequest(verify2FASchema), handleVerify2FA);
router.post('/resend', strictLimiter, validateRequest(resend2FASchema), handleResend2FA);
router.post('/refresh', authLimiter, handleRefreshToken);
router.post('/logout', handleLogout); // No auth required - just clears cookie
router.post('/forgot-password', passwordResetLimiter, validateRequest(forgotPasswordSchema), handleForgotPassword);
router.post('/reset-password', passwordResetLimiter, validateRequest(resetPasswordSchema), handleResetPassword);

export default router;
