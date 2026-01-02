import type { JwtUser } from '../utils/jwt.js';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtUser;
    }
  }
}

export {};
