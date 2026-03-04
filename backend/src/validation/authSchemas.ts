import { z } from 'zod';

// Login
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    deviceFingerprint: z.string().optional(),
  }),
});

// Verify 2FA
export const verify2FASchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
    code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
    trustDevice: z.boolean().optional(),
    deviceFingerprint: z.string().optional(),
    deviceName: z.string().optional(),
  }),
});

// Forgot Password
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

// Reset Password
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

// Resend 2FA Code
export const resend2FASchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});
