export type UserRole = string;
export type Permission =
  | 'read:accounts'
  | 'write:accounts'
  | 'read:youth_profiles'
  | 'write:youth_profiles'
  | 'read:schools'
  | 'write:schools'
  | 'read:outreach'
  | 'write:outreach'
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
