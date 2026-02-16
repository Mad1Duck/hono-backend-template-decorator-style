import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './client';

// ── Schemas ──────────────────────────────────────────
import * as httpLogSchema from './schema/default/httpLogs.schema';
import * as userSchema from './schema/user.schema';

// ── Relations ────────────────────────────────────────
import * as httpLogRelations from './relations/httpLogs.relations';

/* ================= MERGED SCHEMA ================= */
const schema = {
  ...userSchema,
  ...httpLogSchema,
  ...httpLogRelations,
};

/* ================= DB INSTANCE ================= */

export const db = drizzle(pool, { schema });

export type Db = typeof db;

/* ================= HEALTH CHECK ================= */

export async function checkDbConnection(): Promise<boolean> {
  try {
    const result = await pool.query<{ result: number; }>('SELECT 1 AS result');
    return result.rows[0]?.result === 1;
  } catch {
    return false;
  }
}

/* ================= RE-EXPORTS ================= */
export * from './schema/user.schema';
export * from './schema/default/httpLogs.schema';
export * from './relations/httpLogs.relations';