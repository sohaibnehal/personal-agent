import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required — copy .env.local.example to .env.local');
}

export const rawClient = neon(process.env.DATABASE_URL);
export const db = drizzle(rawClient, { schema });
