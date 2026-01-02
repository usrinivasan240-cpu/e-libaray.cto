import jwt from 'jsonwebtoken';
import { env } from '../config.js';

export const ROLE_VALUES = ['USER', 'LIBRARY_ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLE_VALUES)[number];

export type JwtUser = {
  userId: string;
  role: Role;
};

export function parseRole(value: unknown): Role {
  if (ROLE_VALUES.includes(value as Role)) return value as Role;
  throw new Error('Invalid role');
}

export function signAccessToken(user: JwtUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtUser {
  return jwt.verify(token, env.JWT_SECRET) as JwtUser;
}
