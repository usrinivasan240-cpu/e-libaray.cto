import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';

import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import booksRouter from './routes/books.js';
import printRouter from './routes/print.js';
import paymentRouter from './routes/payment.js';
import adminRouter from './routes/admin.js';
import { env } from './config.js';

export function createApp() {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: env.CORS_ORIGIN ?? true,
      credentials: true,
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/books', booksRouter);
  app.use('/print', printRouter);
  app.use('/payment', paymentRouter);
  app.use('/admin', adminRouter);

  const publicDir = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicDir));

  app.use((_req, res) => {
    return res.status(404).json({ error: { message: 'Not found' } });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  });

  return app;
}
