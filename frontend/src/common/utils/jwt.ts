/**
 * Decode JWT token payload without verification
 * Note: This does NOT verify the signature - only use for client-side checks
 * Backend must always verify tokens properly
 */
export interface JwtPayload {
  exp?: number;
  role?: string;
  permissions?: string[];
  [claim: string]: unknown;
}

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return JSON.parse(atob(token.split('.')[1])) as JwtPayload;
  } catch {
    return null;
  }
};

/**
 * Check if JWT token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  
  return payload.exp * 1000 < Date.now();
};

/**
 * Get token expiry timestamp in milliseconds
 */
export const getTokenExpiry = (token: string): number | null => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return null;
  
  return payload.exp * 1000;
};

/**
 * Get time until token expires in milliseconds
 */
export const getTimeUntilExpiry = (token: string): number | null => {
  const expiryTime = getTokenExpiry(token);
  if (!expiryTime) return null;
  
  const timeRemaining = expiryTime - Date.now();
  return timeRemaining > 0 ? timeRemaining : 0;
};
