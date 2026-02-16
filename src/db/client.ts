import { env } from '@/config/env.config';
import { Pool } from 'pg';

/* ================= CONNECTION POOL ================= */
export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

process.on('SIGTERM', async () => {
  await pool.end();
});

process.on('SIGINT', async () => {
  await pool.end();
});