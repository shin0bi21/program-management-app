import { Router } from 'express';
import { handleLogin, handleForgotPassword, handleResetPassword, handleRefreshToken, handleLogout, handleVerify2FA, handleResend2FA } from '../controllers/authController';
import { authLimiter, strictLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import { validateRequest, asyncHandler } from '../middleware/routeMiddleware';
import { 
  loginSchema, 
  verify2FASchema, 
  resend2FASchema, 
  forgotPasswordSchema, 
  resetPasswordSchema 
} from '../validation/authSchemas';

const router = Router();

router.post('/login', authLimiter, validateRequest(loginSchema), asyncHandler(handleLogin));
router.post('/verify', strictLimiter, validateRequest(verify2FASchema), asyncHandler(handleVerify2FA));
router.post('/resend', strictLimiter, validateRequest(resend2FASchema), asyncHandler(handleResend2FA));
router.post('/refresh', authLimiter, asyncHandler(handleRefreshToken));
router.post('/logout', authLimiter, asyncHandler(handleLogout));
router.post('/forgot-password', passwordResetLimiter, validateRequest(forgotPasswordSchema), asyncHandler(handleForgotPassword));
router.post('/reset-password', passwordResetLimiter, validateRequest(resetPasswordSchema), asyncHandler(handleResetPassword));

export default router;
