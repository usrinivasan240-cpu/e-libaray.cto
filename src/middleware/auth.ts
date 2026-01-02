import type { RequestHandler } from 'express';
import { verifyAccessToken, type JwtUser } from '../utils/jwt.js';

function extractTokenFromRequest(req: { headers: { authorization?: string } }): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: { message: 'Missing Authorization Bearer token' } });
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
};

export function requireRole(allowed: JwtUser['role'][]): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }

    if (!allowed.includes(req.auth.role)) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    return next();
  };
}
