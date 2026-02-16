import { defineConfig } from 'drizzle-kit';
import { env } from './src/config/env.config';

export default defineConfig({
  schema: "./src/db/schema/**/*.ts",
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    ssl: env.DB_SSL
      ? { rejectUnauthorized: false }
      : false,
  },
});
