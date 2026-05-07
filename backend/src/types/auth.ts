export type UserRole = 'admin' | 'staff' | 'youth';
export type Permission =
  | 'read:staff'
  | 'write:staff'
  | 'read:youth'
  | 'write:youth'
  | 'read:schools'
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


