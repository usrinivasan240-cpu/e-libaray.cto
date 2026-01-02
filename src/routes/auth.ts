import { Router } from 'express';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signAccessToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { env } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const passwordLoginSchema = z.object({
  provider: z.literal('password').default('password'),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
});

const googleLoginSchema = z.object({
  provider: z.literal('google'),
  idToken: z.string().min(1),
});

const loginSchema = z.union([passwordLoginSchema, googleLoginSchema]);

type LoginBody = z.infer<typeof loginSchema>;

function publicUser(u: {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: Date;
  last_login: Date | null;
}) {
  return {
    user_id: u.user_id,
    name: u.name,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
    last_login: u.last_login,
  };
}

const bootstrapSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

router.post(
  '/bootstrap-super-admin',
  validateBody(bootstrapSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
    if (existing > 0) {
      return res
        .status(409)
        .json({ error: { message: 'SUPER_ADMIN already exists. Bootstrap endpoint disabled.' } });
    }

    const { name, email, password } = req.body as z.infer<typeof bootstrapSchema>;

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: await hashPassword(password),
        role: 'SUPER_ADMIN',
        last_login: new Date(),
      },
    });

    const token = signAccessToken({ userId: user.user_id, role: user.role });

    return res.status(201).json({ token, user: publicUser(user) });
  }),
);

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as LoginBody;

    if (body.provider === 'google') {
      if (!env.GOOGLE_CLIENT_ID) {
        return res.status(501).json({
          error: {
            message: 'Google login is not configured (missing GOOGLE_CLIENT_ID)',
          },
        });
      }

      const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: body.idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const email = payload?.email;
      const name = payload?.name ?? 'User';

      if (!email) {
        return res.status(400).json({ error: { message: 'Google token did not contain an email' } });
      }

      const user = await prisma.user.upsert({
        where: { email },
        update: { last_login: new Date(), name },
        create: {
          email,
          name,
          role: 'USER',
          last_login: new Date(),
        },
      });

      const token = signAccessToken({ userId: user.user_id, role: user.role });

      return res.json({
        token,
        user: publicUser(user),
      });
    }

    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (!existing) {
      const created = await prisma.user.create({
        data: {
          email,
          name: body.name ?? email.split('@')[0] ?? 'User',
          password: await hashPassword(body.password),
          role: 'USER',
          last_login: new Date(),
        },
      });

      const token = signAccessToken({ userId: created.user_id, role: created.role });
      return res.status(201).json({ token, user: publicUser(created) });
    }

    if (!existing.password) {
      return res.status(400).json({
        error: {
          message: 'Account exists but does not have a password set. Use Google login or contact admin.',
        },
      });
    }

    const ok = await verifyPassword(body.password, existing.password);
    if (!ok) {
      return res.status(401).json({ error: { message: 'Invalid email or password' } });
    }

    const user = await prisma.user.update({
      where: { user_id: existing.user_id },
      data: { last_login: new Date() },
    });

    const token = signAccessToken({ userId: user.user_id, role: user.role });

    return res.json({ token, user: publicUser(user) });
  }),
);

router.post('/logout', (_req, res) => {
  return res.json({ ok: true });
});

router.get(
  '/user',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { user_id: req.auth!.userId } });
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });
    return res.json({ user: publicUser(user) });
  }),
);

export default router;
