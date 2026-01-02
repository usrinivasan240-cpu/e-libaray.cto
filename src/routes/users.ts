import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { user_id: req.auth!.userId } });
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });
    return res.json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        last_login: user.last_login,
      },
    });
  }),
);

router.get(
  '/print-history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const jobs = await prisma.printJob.findMany({
      where: { user_id: req.auth!.userId },
      orderBy: { created_at: 'desc' },
      include: {
        payments: {
          orderBy: { created_at: 'desc' },
        },
      },
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
        payments: j.payments.map((p) => ({
          payment_id: p.payment_id,
          payment_method: p.payment_method,
          transaction_id: p.transaction_id,
          payment_status: p.payment_status,
          paid_at: p.paid_at,
          created_at: p.created_at,
        })),
      })),
    });
  }),
);

export default router;
