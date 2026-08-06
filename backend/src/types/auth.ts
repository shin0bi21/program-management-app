export type UserRole = string;
export type Permission =
  | 'read:accounts'
  | 'write:accounts'
  | 'read:youth_profiles'
  | 'write:youth_profiles'
  | 'read:schools'
  | 'read:programs'
  | 'write:programs'
  | 'read:cohorts'
  | 'write:cohorts'
  | 'read:sessions'
  | 'write:sessions'
  | 'read:attendance'
  | 'write:attendance'
  | 'write:schools'
  | 'read:outreach'
  | 'write:outreach'
  | 'read:homepage'
  | 'write:homepage'
  | 'read:settings'
  | 'write:settings';

export interface BaseTokenPayload {
  userId: string;
  email: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AccessTokenPayload extends BaseTokenPayload {
  role: UserRole;
  permissions: Permission[];
  tokenType: 'access';
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload extends BaseTokenPayload {
  tokenType: 'refresh';
  iat: number;
  exp: number;
}
