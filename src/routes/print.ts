import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

const router = Router();

const uploadSchema = z.object({
  total_pages: z.coerce.number().int().min(1),
  cost_per_page: z.coerce.number().int().min(1).default(2),
});

router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Invalid upload data', details: parsed.error.flatten() } });
    }

    if (!req.file) {
      return res.status(400).json({ error: { message: 'Missing file' } });
    }

    const totalCost = parsed.data.total_pages * parsed.data.cost_per_page;

    const job = await prisma.printJob.create({
      data: {
        user_id: req.auth!.userId,
        file_name: req.file.originalname,
        storage_path: req.file.filename,
        total_pages: parsed.data.total_pages,
        cost_per_page: parsed.data.cost_per_page,
        total_cost: totalCost,
        payment_status: 'PENDING',
      },
    });

    return res.status(201).json({
      print_job: {
        print_id: job.print_id,
        file_name: job.file_name,
        total_pages: job.total_pages,
        cost_per_page: job.cost_per_page,
        total_cost: job.total_cost,
        payment_status: job.payment_status,
        created_at: job.created_at,
      },
    });
  }),
);

const previewSchema = z.object({
  print_id: z.string().min(1),
});

router.post(
  '/preview',
  requireAuth,
  validateBody(previewSchema),
  asyncHandler(async (req, res) => {
    const { print_id } = req.body as z.infer<typeof previewSchema>;

    const job = await prisma.printJob.findUnique({ where: { print_id } });
    if (!job) return res.status(404).json({ error: { message: 'Print job not found' } });

    if (job.user_id !== req.auth!.userId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    return res.json({
      print_job: {
        print_id: job.print_id,
        file_name: job.file_name,
        total_pages: job.total_pages,
        cost_per_page: job.cost_per_page,
        total_cost: job.total_cost,
        payment_status: job.payment_status,
        created_at: job.created_at,
      },
    });
  }),
);

const confirmSchema = z.object({
  print_id: z.string().min(1),
});

router.post(
  '/confirm',
  requireAuth,
  validateBody(confirmSchema),
  asyncHandler(async (req, res) => {
    const { print_id } = req.body as z.infer<typeof confirmSchema>;

    const job = await prisma.printJob.findUnique({ where: { print_id } });
    if (!job) return res.status(404).json({ error: { message: 'Print job not found' } });

    if (job.user_id !== req.auth!.userId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    return res.json({ ok: true, print_id: job.print_id });
  }),
);

router.get(
  '/history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const jobs = await prisma.printJob.findMany({
      where: { user_id: req.auth!.userId },
      orderBy: { created_at: 'desc' },
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
      })),
    });
  }),
);

export default router;
