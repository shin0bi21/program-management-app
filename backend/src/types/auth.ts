import type { PermissionLevel } from './database';

export interface BaseTokenPayload {
  userId: string;
  email: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AccessTokenPayload extends BaseTokenPayload {
  permission: PermissionLevel;
  tokenType: 'access';
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload extends BaseTokenPayload {
  tokenType: 'refresh';
  iat: number;
  exp: number;
}
