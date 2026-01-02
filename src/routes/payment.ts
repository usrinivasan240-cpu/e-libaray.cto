import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildUpiPayUri } from '../utils/upi.js';

const router = Router();

const initiateSchema = z.object({
  print_id: z.string().min(1),
  payment_method: z.enum(['UPI', 'GPAY']).default('UPI'),
});

router.post(
  '/initiate',
  requireAuth,
  validateBody(initiateSchema),
  asyncHandler(async (req, res) => {
    const { print_id, payment_method } = req.body as z.infer<typeof initiateSchema>;

    const job = await prisma.printJob.findUnique({ where: { print_id } });
    if (!job) return res.status(404).json({ error: { message: 'Print job not found' } });

    if (job.user_id !== req.auth!.userId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    if (job.payment_status === 'SUCCESS') {
      return res.status(409).json({ error: { message: 'Print job is already paid' } });
    }

    const payment = await prisma.payment.create({
      data: {
        user_id: req.auth!.userId,
        print_id,
        payment_method,
        payment_status: 'PENDING',
      },
    });

    const upiUri = buildUpiPayUri({
      payeeVpa: env.UPI_VPA,
      payeeName: env.UPI_PAYEE_NAME,
      amount: job.total_cost,
      transactionNote: `Print job ${job.print_id}`,
      transactionRef: payment.payment_id,
    });

    return res.status(201).json({
      payment: {
        payment_id: payment.payment_id,
        payment_method: payment.payment_method,
        payment_status: payment.payment_status,
        created_at: payment.created_at,
      },
      upi_uri: upiUri,
    });
  }),
);

const verifySchema = z.object({
  payment_id: z.string().min(1),
  transaction_id: z.string().min(1),
  payment_status: z.enum(['SUCCESS', 'FAILED']),
});

router.post(
  '/verify',
  requireAuth,
  validateBody(verifySchema),
  asyncHandler(async (req, res) => {
    const { payment_id, transaction_id, payment_status } = req.body as z.infer<typeof verifySchema>;

    const payment = await prisma.payment.findUnique({ where: { payment_id } });
    if (!payment) return res.status(404).json({ error: { message: 'Payment not found' } });

    if (payment.user_id !== req.auth!.userId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { payment_id },
        data: {
          transaction_id,
          payment_status,
          paid_at: payment_status === 'SUCCESS' ? new Date() : null,
        },
      });

      await tx.printJob.update({
        where: { print_id: payment.print_id },
        data: { payment_status },
      });

      return p;
    });

    return res.json({
      payment: {
        payment_id: updated.payment_id,
        payment_status: updated.payment_status,
        transaction_id: updated.transaction_id,
        paid_at: updated.paid_at,
      },
    });
  }),
);

router.get(
  '/status/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const paymentId = req.params.id;
    const payment = await prisma.payment.findUnique({
      where: { payment_id: paymentId },
      include: { print: true },
    });

    if (!payment) return res.status(404).json({ error: { message: 'Payment not found' } });

    const isOwner = payment.user_id === req.auth!.userId;
    const isAdmin = req.auth!.role === 'LIBRARY_ADMIN' || req.auth!.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    return res.json({
      payment: {
        payment_id: payment.payment_id,
        user_id: payment.user_id,
        print_id: payment.print_id,
        payment_method: payment.payment_method,
        transaction_id: payment.transaction_id,
        payment_status: payment.payment_status,
        paid_at: payment.paid_at,
        created_at: payment.created_at,
      },
      print_job: {
        total_cost: payment.print.total_cost,
        payment_status: payment.print.payment_status,
      },
    });
  }),
);

export default router;
