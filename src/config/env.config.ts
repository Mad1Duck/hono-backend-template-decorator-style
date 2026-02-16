import { z } from 'zod';

/* ================= HELPERS ================= */

/**
 * Convert empty string ("") to undefined
 */
const emptyToUndefined = <T extends z.ZodTypeAny>(
  schema: T
) =>
  z.preprocess(
    (v) => (v === '' ? undefined : v),
    schema.optional()
  );

/* ================= SCHEMA ================= */

const envSchema = z.object({
  /* ---------- Server ---------- */

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce
    .number()
    .min(1000)
    .max(65535)
    .default(3000),

  /* ---------- Auth ---------- */

  JWT_SECRET: z.string().min(32),

  JWT_EXPIRES_IN: z
    .string()
    .default('7d'),

  /* ---------- Logging ---------- */

  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),

  LOG_TO_FILE: z.coerce.boolean().default(true),

  LOG_TO_DB: z.coerce.boolean().default(false),

  LOG_FILE_RETENTION_DAYS: z.coerce
    .number()
    .min(1)
    .default(30),

  LOG_DB_RETENTION_DAYS: z.coerce
    .number()
    .min(1)
    .default(30),

  LOG_CLEANUP_SCHEDULE: z
    .string()
    .default('0 0 * * 0'),

  LOG_DIR: z
    .string()
    .default('logs'),


  /* ---------- Security ---------- */

  RATE_LIMIT_WHITELIST: emptyToUndefined(
    z.string()
  ),

  ALLOWED_ORIGINS: emptyToUndefined(
    z.string()
  ),

  RATE_LIMIT_MAX: z.coerce
    .number()
    .default(100),

  /* ---------- Redis Cache ---------- */

  REDIS_CACHE_HOST: z
    .string()
    .default('localhost'),

  REDIS_CACHE_PORT: z.coerce
    .number()
    .min(1)
    .max(65535)
    .default(6379),

  REDIS_CACHE_PASSWORD: emptyToUndefined(
    z.string()
  ),

  REDIS_CACHE_DB: z.coerce
    .number()
    .default(0),

  /* ---------- Redis Queue ---------- */

  REDIS_QUEUE_HOST: z
    .string()
    .default('localhost'),

  REDIS_QUEUE_PORT: z.coerce
    .number()
    .min(1)
    .max(65535)
    .default(6380),

  REDIS_QUEUE_PASSWORD: emptyToUndefined(
    z.string()
  ),

  REDIS_QUEUE_DB: z.coerce
    .number()
    .default(1),

  /* ---------- RabbitMQ ---------- */

  RABBITMQ_URL: z
    .string()
    .url()
    .default('amqp://localhost:5672'),

  RABBITMQ_EXCHANGE: emptyToUndefined(
    z.string()
  ),

  /* ---------- Observability ---------- */

  OTLP_ENDPOINT: emptyToUndefined(
    z.string().url()
  ),

  OTLP_HEADERS: emptyToUndefined(
    z.string()
  ),

  SENTRY_DSN: emptyToUndefined(
    z.string().url()
  ),

  /* ---------- Api Key ---------- */

  API_KEYS: z.string().default('zxxytws'),

  /* ---------- Database ---------- */

  DB_HOST: z.string().default('localhost'),

  DB_PORT: z.coerce
    .number()
    .min(1)
    .max(65535)
    .default(5432),

  DB_USER: z.string().default('postgres'),

  DB_PASS: z.string().default('postgres'),

  DB_NAME: z.string().default('app_db'),

  DB_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false')
});

/* ================= PARSE ================= */

const parsed = envSchema.safeParse(
  process.env
);

if (!parsed.success) {
  console.error(
    'Invalid environment variables'
  );

  console.error(
    JSON.stringify(
      parsed.error.format(),
      null,
      2
    )
  );

  process.exit(1);
}

/* ================= EXPORT ================= */

export const env = parsed.data;

export type Env = z.infer<
  typeof envSchema
>;

/* ================= FLAGS ================= */

export const isDevelopment =
  env.NODE_ENV === 'development';

export const isProduction =
  env.NODE_ENV === 'production';

export const isTest =
  env.NODE_ENV === 'test';
