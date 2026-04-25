import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { PermissionLevel } from '../types/database';
import type { AccessTokenPayload } from '../types/auth';
import { requireEnv } from '../utils/env';
import { isBlacklisted } from '../services/tokenRevocationService';

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
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Verify JWT signature and decode
    const verified = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

    // Reject refresh tokens sent to protected routes
    if (verified.tokenType !== 'access') {
      return res.status(403).json({ error: 'Invalid token type' });
    }
    
    // Check if token is blacklisted
    if (verified.jti && await isBlacklisted(verified.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
    
    // Attach user to request
    (req as AuthRequest).user = verified;
    next();
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    console.error('Authentication error:', error);
    res.status(403).json({ error: 'Authentication failed' });
  }
};

// Optional: Permission-based authorization
export const requirePermission = (...allowedPermissions: PermissionLevel[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!allowedPermissions.includes(authReq.user.permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};


