import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Permission } from '../types/auth';
import type { AccessTokenPayload } from '../types/auth';
import { requireEnv } from '../utils/env';
import { isBlacklisted } from '../services/tokenRevocationService';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { asyncHandler } from './errorHandler';

const JWT_SECRET = requireEnv('JWT_SECRET');

// Extend Express Request
export interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}

export const authenticateToken = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) throw new UnauthorizedError('Access denied. No token provided.');

  let verified: AccessTokenPayload;
  try {
    verified = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw new UnauthorizedError('Token expired');
    if (error instanceof jwt.JsonWebTokenError) throw new ForbiddenError('Invalid token');
    throw error;
  }

  if (verified.tokenType !== 'access') throw new ForbiddenError('Invalid token type');

  if (verified.jti && await isBlacklisted(verified.jti)) {
    throw new UnauthorizedError('Token has been revoked');
  }

  (req as AuthRequest).user = verified;
  next();
});

// Permission-based authorization — use after authenticateToken
export const requirePermission = (...required: Permission[]) =>
  asyncHandler(async (req, _res, next) => {
    const authReq = req as AuthRequest;
    if (!authReq.user) throw new UnauthorizedError('Not authenticated');

    const hasAll = required.every(p => authReq.user!.permissions.includes(p));
    if (!hasAll) throw new ForbiddenError('Insufficient permissions');

    next();
  });


