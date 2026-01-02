import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hashPassword } from '../utils/password.js';

const router = Router();

router.get(
  '/dashboard',
  requireAuth,
  requireRole(['LIBRARY_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (_req, res) => {
    const [books, users, activeIssues, pendingPrints, payments] = await Promise.all([
      prisma.book.count(),
      prisma.user.count(),
      prisma.bookIssue.count({ where: { returned_date: null } }),
      prisma.printJob.count({ where: { payment_status: 'PENDING' } }),
      prisma.payment.count(),
    ]);

    return res.json({
      stats: {
        books,
        users,
        activeIssues,
        pendingPrints,
        payments,
      },
    });
  }),
);

router.get(
  '/print-jobs',
  requireAuth,
  requireRole(['LIBRARY_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (_req, res) => {
    const jobs = await prisma.printJob.findMany({
      orderBy: { created_at: 'desc' },
      include: { user: true },
    });

    return res.json({
      items: jobs.map((j) => ({
        print_id: j.print_id,
        file_name: j.file_name,
        total_pages: j.total_pages,
        cost_per_page: j.cost_per_page,
        total_cost: j.total_cost,
        payment_status: j.payment_status,
        created_at: j.created_at,
        user: {
          user_id: j.user.user_id,
          name: j.user.name,
          email: j.user.email,
          role: j.user.role,
        },
      })),
    });
  }),
);

router.get(
  '/transactions',
  requireAuth,
  requireRole(['LIBRARY_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (_req, res) => {
    const payments = await prisma.payment.findMany({
      orderBy: { created_at: 'desc' },
      include: { user: true, print: true },
    });

    return res.json({
      items: payments.map((p) => ({
        payment_id: p.payment_id,
        payment_method: p.payment_method,
        transaction_id: p.transaction_id,
        payment_status: p.payment_status,
        paid_at: p.paid_at,
        created_at: p.created_at,
        user: {
          user_id: p.user.user_id,
          name: p.user.name,
          email: p.user.email,
          role: p.user.role,
        },
        print_job: {
          print_id: p.print.print_id,
          file_name: p.print.file_name,
          total_cost: p.print.total_cost,
        },
      })),
    });
  }),
);

router.get(
  '/users',
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { created_at: 'desc' } });
    return res.json({
      items: users.map((u) => ({
        user_id: u.user_id,
        name: u.name,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
        last_login: u.last_login,
      })),
    });
  }),
);

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['USER', 'LIBRARY_ADMIN', 'SUPER_ADMIN']),
});

router.post(
  '/users',
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body as z.infer<typeof createUserSchema>;

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: await hashPassword(password),
        role,
      },
    });

    return res.status(201).json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
    });
  }),
);

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['USER', 'LIBRARY_ADMIN', 'SUPER_ADMIN']).optional(),
  password: z.string().min(6).optional(),
});

router.put(
  '/users/:id',
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { name, role, password } = req.body as z.infer<typeof updateUserSchema>;

    const user = await prisma.user.update({
      where: { user_id: userId },
      data: {
        ...(name ? { name } : {}),
        ...(role ? { role } : {}),
        ...(password ? { password: await hashPassword(password) } : {}),
      },
    });

    return res.json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }),
);

router.delete(
  '/users/:id',
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { user_id: req.params.id } });
    return res.status(204).send();
  }),
);

export default router;
