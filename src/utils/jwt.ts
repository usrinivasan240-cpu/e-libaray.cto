import jwt from 'jsonwebtoken';
import { env } from '../config.js';

export type JwtUser = {
  userId: string;
  role: 'USER' | 'LIBRARY_ADMIN' | 'SUPER_ADMIN';
};

export function signAccessToken(user: JwtUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtUser {
  return jwt.verify(token, env.JWT_SECRET) as JwtUser;
}
