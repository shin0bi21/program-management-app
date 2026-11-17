import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import type { AccessTokenPayload, Permission } from '../types/auth';
import { requireEnv } from '../utils/env';
import { isBlacklisted } from '../services/auth/tokenRevocationService';
import { isAccountActive } from '../services/auth/accountStatusService';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { asyncHandler } from './routeMiddleware';

const JWT_SECRET = requireEnv('JWT_SECRET');

/** Request carrying the access-token identity attached after authentication succeeds. */
export interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}

/**
 * Verifies an access token, rejects revoked tokens or inactive accounts, and attaches its identity.
 * Account status and revocation are read through auth services; failures reach the global handler.
 * @example router.use(authenticateToken);
 */
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

  if (!(await isAccountActive(verified.userId))) {
    throw new ForbiddenError('Account is inactive');
  }

  (req as AuthRequest).user = verified;
  next();
});

/**
 * Requires every listed endpoint capability after authentication; missing capabilities are 403.
 * @param required - Permissions the authenticated user must all hold.
 * @returns Middleware rejecting unauthenticated requests with 401 and continuing authorized requests.
 * @example router.use(authenticateToken, requirePermission('read:accounts'));
 */
export const requirePermission = (...required: Permission[]) =>
  asyncHandler(async (req, _res, next) => {
    const user = (req as AuthRequest).user;
    if (!user) throw new UnauthorizedError('Not authenticated');

    const hasAll = required.every(permission => user.permissions.includes(permission));
    if (!hasAll) throw new ForbiddenError('Insufficient permissions');

    next();
  });

/**
 * Requires at least one listed endpoint capability after authentication; missing capabilities are 403.
 * Reference lookups may serve several independently authorized page capabilities.
 * @param required - Alternative permissions, any one of which permits the request.
 * @returns Middleware rejecting unauthenticated requests with 401 and continuing authorized requests.
 * @example router.use(authenticateToken, requireAnyPermission('read:programs', 'read:sessions'));
 */
export const requireAnyPermission = (...required: Permission[]) =>
  asyncHandler(async (req, _res, next) => {
    const user = (req as AuthRequest).user;
    if (!user) throw new UnauthorizedError('Not authenticated');
    if (!required.some(permission => user.permissions.includes(permission))) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  });
