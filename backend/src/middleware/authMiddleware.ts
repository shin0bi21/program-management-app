import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sql } from '../db/client';
import type { PermissionLevel } from '../types/database';

const JWT_SECRET = process.env.JWT_SECRET!;

// JWT Payload type
interface JWTPayload {
  userId: string;
  email: string;
  permission: PermissionLevel;
  jti?: string;
  iat: number;
  exp: number;
}

// Extend Express Request
export interface AuthRequest extends Request {
  user?: JWTPayload;
}

// Simple in-memory blacklist cache
const blacklistCache = new Set<string>();
let lastCacheUpdate = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

async function refreshBlacklistCache() {
  try {
    const blacklisted = await sql<{ jti: string }[]>`
      SELECT jti FROM token_blacklist
      WHERE expires_at > NOW()
    `;
    
    blacklistCache.clear();
    blacklisted.forEach(row => blacklistCache.add(row.jti));
    lastCacheUpdate = Date.now();
  } catch (error) {
    console.error('Failed to refresh blacklist cache:', error);
  }
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
    const verified = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Check if token is blacklisted (with caching)
    if (verified.jti) {
      // Refresh cache if stale
      if (Date.now() - lastCacheUpdate > CACHE_TTL) {
        await refreshBlacklistCache();
      }
      
      // Check in-memory cache
      if (blacklistCache.has(verified.jti)) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
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

// Initialize cache on startup
refreshBlacklistCache();

// Export cache for use in logout
export { blacklistCache };
