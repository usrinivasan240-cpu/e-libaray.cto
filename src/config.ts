import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().optional(),

  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('7d'),

  UPI_VPA: z.string().default('library@upi'),
  UPI_PAYEE_NAME: z.string().default('E-Library'),

  GOOGLE_CLIENT_ID: z.string().optional(),
});

export const env = envSchema.parse({
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  UPI_VPA: process.env.UPI_VPA,
  UPI_PAYEE_NAME: process.env.UPI_PAYEE_NAME,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
});
