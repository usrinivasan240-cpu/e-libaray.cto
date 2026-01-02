import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const createBookSchema = z.object({
  book_name: z.string().min(1),
  author_name: z.string().min(1),
  category: z.string().min(1),
  publication_year: z.coerce.number().int().min(0),
  library_location: z.string().min(1),
});

const updateBookSchema = createBookSchema.partial();

const issueSchema = z.object({
  book_id: z.string().min(1),
  user_id: z.string().min(1),
  due_date: z.coerce.date(),
});

const returnSchema = z.object({
  issue_id: z.string().min(1).optional(),
  book_id: z.string().min(1).optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const author = typeof req.query.author === 'string' ? req.query.author.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

    const books = await prisma.book.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  { book_name: { contains: q, mode: 'insensitive' } },
                  { author_name: { contains: q, mode: 'insensitive' } },
                  { category: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {},
          author ? { author_name: { contains: author, mode: 'insensitive' } } : {},
          category ? { category: { contains: category, mode: 'insensitive' } } : {},
        ],
      },
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      items: books.map((b) => ({
        book_id: b.book_id,
        book_name: b.book_name,
        author_name: b.author_name,
        category: b.category,
        publication_year: b.publication_year,
        library_location: b.library_location,
        status: b.status,
        created_at: b.created_at,
      })),
    });
  }),
);

router.get(
  '/search',
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const items = await prisma.book.findMany({
      where: q
        ? {
            OR: [
              { book_name: { contains: q, mode: 'insensitive' } },
              { author_name: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { created_at: 'desc' },
    });

    return res.json({
      items: items.map((b) => ({
        book_id: b.book_id,
        book_name: b.book_name,
        author_name: b.author_name,
        category: b.category,
        publication_year: b.publication_year,
        library_location: b.library_location,
        status: b.status,
      })),
    });
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole(['LIBRARY_ADMIN', 'SUPER_ADMIN']),
  validateBody(createBookSchema),
  asyncHandler(async (req, res) => {
    const book = await prisma.book.create({ data: req.body });
    return res.status(201).json({ book });
  }),
);

router.put(
  '/:id',
  requireAuth,
  requireRole(['LIBRARY_ADMIN', 'SUPER_ADMIN']),
  validateBody(updateBookSchema),
  asyncHandler(async (req, res) => {
    const updated = await prisma.book.update({ where: { book_id: req.params.id }, data: req.body });
    return res.json({ book: updated });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  asyncHandler(async (req, res) => {
    await prisma.book.delete({ where: { book_id: req.params.id } });
    return res.status(204).send();
  }),
);

router.post(
  '/issue',
  requireAuth,
  requireRole(['LIBRARY_ADMIN', 'SUPER_ADMIN']),
  validateBody(issueSchema),
  asyncHandler(async (req, res) => {
    const { book_id, user_id, due_date } = req.body as z.infer<typeof issueSchema>;

    const book = await prisma.book.findUnique({ where: { book_id } });
    if (!book) return res.status(404).json({ error: { message: 'Book not found' } });
    if (book.status !== 'AVAILABLE') {
      return res.status(409).json({ error: { message: 'Book is not available' } });
    }

    const user = await prisma.user.findUnique({ where: { user_id } });
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });

    const issue = await prisma.$transaction(async (tx) => {
      const created = await tx.bookIssue.create({
        data: {
          book_id,
          user_id,
          due_date,
        },
      });

      await tx.book.update({ where: { book_id }, data: { status: 'ISSUED' } });

      return created;
    });

    return res.status(201).json({ issue });
  }),
);

router.post(
  '/return',
  requireAuth,
  requireRole(['LIBRARY_ADMIN', 'SUPER_ADMIN']),
  validateBody(returnSchema),
  asyncHandler(async (req, res) => {
    const { issue_id, book_id } = req.body as z.infer<typeof returnSchema>;

    if (!issue_id && !book_id) {
      return res.status(400).json({ error: { message: 'Provide issue_id or book_id' } });
    }

    const issue = await prisma.bookIssue.findFirst({
      where: {
        returned_date: null,
        ...(issue_id ? { issue_id } : {}),
        ...(book_id ? { book_id } : {}),
      },
      orderBy: { issued_date: 'desc' },
    });

    if (!issue) return res.status(404).json({ error: { message: 'Active issue not found' } });

    const returned = await prisma.$transaction(async (tx) => {
      const updated = await tx.bookIssue.update({
        where: { issue_id: issue.issue_id },
        data: { returned_date: new Date() },
      });

      await tx.book.update({
        where: { book_id: issue.book_id },
        data: { status: 'AVAILABLE' },
      });

      return updated;
    });

    return res.json({ issue: returned });
  }),
);

router.get(
  '/issued',
  requireAuth,
  requireRole(['LIBRARY_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (_req, res) => {
    const issues = await prisma.bookIssue.findMany({
      where: { returned_date: null },
      orderBy: { issued_date: 'desc' },
      include: { book: true, user: true },
    });

    return res.json({
      items: issues.map((i) => ({
        issue_id: i.issue_id,
        issued_date: i.issued_date,
        due_date: i.due_date,
        book: {
          book_id: i.book.book_id,
          book_name: i.book.book_name,
          author_name: i.book.author_name,
          category: i.book.category,
        },
        borrower: {
          user_id: i.user.user_id,
          name: i.user.name,
          email: i.user.email,
        },
      })),
    });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const bookId = req.params.id;

    const book = await prisma.book.findUnique({ where: { book_id: bookId } });
    if (!book) return res.status(404).json({ error: { message: 'Book not found' } });

    const activeIssue = await prisma.bookIssue.findFirst({
      where: { book_id: bookId, returned_date: null },
      orderBy: { issued_date: 'desc' },
      include: { user: true },
    });

    return res.json({
      book: {
        book_id: book.book_id,
        book_name: book.book_name,
        author_name: book.author_name,
        category: book.category,
        publication_year: book.publication_year,
        library_location: book.library_location,
        status: book.status,
        created_at: book.created_at,
        issued: activeIssue
          ? {
              issue_id: activeIssue.issue_id,
              borrower_name: activeIssue.user.name,
              borrower_email: activeIssue.user.email,
              due_date: activeIssue.due_date,
              issued_date: activeIssue.issued_date,
            }
          : null,
      },
    });
  }),
);

export default router;
