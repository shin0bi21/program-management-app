import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { PermissionLevel } from '../types/database';
import type { AccessTokenPayload } from '../types/auth';
import { requireEnv } from '../utils/env';
import { isBlacklisted } from '../services/tokenRevocationService';
import { sendError } from '../errors/AppError';

const JWT_SECRET = requireEnv('JWT_SECRET');

// Extend Express Request
export interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}

export const authenticateToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const rid = res.locals.requestId as string | undefined;
    console.warn(`[${rid ?? '-'}] auth 401 No token`);
    sendError(res, 401, 'Access denied. No token provided.');
    return;
  }

  try {
    // Verify JWT signature and decode
    const verified = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

    // Reject refresh tokens sent to protected routes
    if (verified.tokenType !== 'access') {
      const rid = res.locals.requestId as string | undefined;
      console.warn(`[${rid ?? '-'}] auth 403 Invalid token type`);
      sendError(res, 403, 'Invalid token type');
      return;
    }
    
    // Check if token is blacklisted
    if (verified.jti && await isBlacklisted(verified.jti)) {
      const rid = res.locals.requestId as string | undefined;
      console.warn(`[${rid ?? '-'}] auth 401 Revoked token`);
      sendError(res, 401, 'Token has been revoked');
      return;
    }
    
    // Attach user to request
    (req as AuthRequest).user = verified;
    next();
    
  } catch (error) {
    const rid = res.locals.requestId as string | undefined;
    if (error instanceof jwt.TokenExpiredError) {
      console.warn(`[${rid ?? '-'}] auth 401 Token expired`);
      sendError(res, 401, 'Token expired');
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn(`[${rid ?? '-'}] auth 403 Invalid token`);
      sendError(res, 403, 'Invalid token');
      return;
    }
    
    console.error(`[${rid ?? '-'}] auth 403 Authentication error`, error);
    sendError(res, 403, 'Authentication failed');
  }
};

// Permission-based authorization — use after authenticateToken
export const requirePermission = (...allowedPermissions: PermissionLevel[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      const rid = res.locals.requestId as string | undefined;
      console.warn(`[${rid ?? '-'}] auth 401 Not authenticated`);
      sendError(res, 401, 'Not authenticated');
      return;
    }
    
    if (!allowedPermissions.includes(authReq.user.permission)) {
      const rid = res.locals.requestId as string | undefined;
      console.warn(`[${rid ?? '-'}] auth 403 Insufficient permissions — user: ${authReq.user.permission}`);
      sendError(res, 403, 'Insufficient permissions');
      return;
    }
    
    next();
  };
};


