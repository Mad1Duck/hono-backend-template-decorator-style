import pino from 'pino';
import path from 'node:path';
import { env, isDevelopment } from './env.config';
import { db, httpLogs, errorLogs } from '@/db';

/* ================= LOG CONFIG ================= */


type LogLevel = 'FATAL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

const VALID_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

function toMethod(val: unknown): HttpMethod {
  const upper = String(val ?? '').toUpperCase() as HttpMethod;
  return VALID_METHODS.has(upper) ? upper : 'GET';
}

function toUuid(val: unknown): string | undefined {
  const s = String(val ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    ? s
    : undefined;
}

function toLevel(statusCode: number): LogLevel {
  if (statusCode >= 500) return 'ERROR';
  if (statusCode >= 400) return 'WARN';
  return 'INFO';
}

export interface SaveHttpLogPayload {
  requestId?: string;
  method: string;
  url: string;
  path: string;
  userAgent?: string;
  host?: string;
  statusCode: number;
  duration: number;
  userId?: string;
  action?: string;
  controller?: string;
  handler?: string;
  message?: string;
  metadata?: unknown;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

export interface LogConfig {
  toFile: boolean;
  toDb: boolean;
  fileRetentionDays: number;
  dbRetentionDays: number;
  cleanupSchedule: string;
  logDir: string;
}

export const logConfig: LogConfig = {
  toFile: env.LOG_TO_FILE ?? true,
  toDb: env.LOG_TO_DB ?? true,
  fileRetentionDays: env.LOG_FILE_RETENTION_DAYS ?? 30,
  dbRetentionDays: env.LOG_DB_RETENTION_DAYS ?? 30,
  cleanupSchedule: env.LOG_CLEANUP_SCHEDULE ?? '0 0 * * 0',
  logDir: env.LOG_DIR ?? path.join(process.cwd(), 'logs'),
};

/* ================= TRANSPORT BUILDER ================= */

// ← Return pino.DestinationStream — selalu panggil pino.transport() di dalam
function buildTransport(): pino.DestinationStream {
  if (isDevelopment) {
    return pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    });
  }

  const targets: pino.TransportTargetOptions[] = [
    {
      target: 'pino/file',
      options: { destination: 1 },
      level: env.LOG_LEVEL ?? 'info',
    },
  ];

  if (logConfig.toFile) {
    targets.push({
      target: 'pino/file',
      options: {
        destination: path.join(logConfig.logDir, 'http.log'),
        mkdir: true,
      },
      level: 'info',
    });

    targets.push({
      target: 'pino/file',
      options: {
        destination: path.join(logConfig.logDir, 'error.log'),
        mkdir: true,
      },
      level: 'error',
    });
  }

  return pino.transport({ targets });
}

/* ================= SERIALIZER TYPES ================= */

interface SerializedRequest {
  id?: string;
  method: string;
  url: string;
  path: string;
  headers: { host?: string; userAgent?: string; };
  remoteAddress?: string;
}

interface SerializedResponse {
  statusCode: number;
  headers: Record<string, string | string[] | number | undefined>;
}

/* ================= LOGGER ================= */

export const logger = pino(
  {
    level: env.LOG_LEVEL ?? 'info',
    formatters: {
      level: (label: string) => ({ level: label.toUpperCase() }),
    },
    base: { env: env.NODE_ENV },
    serializers: {
      req: (req: SerializedRequest) => req,
      res: (res: SerializedResponse) => res,
      err: pino.stdSerializers.err,
    },
  },
  buildTransport()
);

export type Logger = typeof logger;

export function createLogger(context: string): Logger {
  return logger.child({ context });
}

export async function saveHttpLog(data: SaveHttpLogPayload): Promise<void> {
  try {
    const method = toMethod(data.method);
    const level = toLevel(data.statusCode);
    const userId = toUuid(data.userId);

    const [httpLog] = await db
      .insert(httpLogs)
      .values({
        requestId: data.requestId?.slice(0, 36),
        method,
        url: data.url,
        path: data.path,
        userAgent: data.userAgent,
        host: data.host,
        statusCode: data.statusCode,
        duration: data.duration,
        userId: userId,
        action: data.action?.slice(0, 100),
        controller: data.controller?.slice(0, 100),
        handler: data.handler?.slice(0, 100),
        level,
        message: data.message || `${method} ${data.path}`,
        metadata: data.metadata,
      })
      .returning({ id: httpLogs.id });

    if (data.error && httpLog?.id) {
      await db
        .insert(errorLogs)
        .values({
          httpLogId: httpLog.id,
          errorCode: data.error.code,
          errorMessage: data.error.message,
          errorStack: data.error.stack,
          errorName: data.error.code.slice(0, 100),
          controller: data.controller?.slice(0, 100),
          handler: data.handler?.slice(0, 100),
          userId: userId,
          requestId: data.requestId?.slice(0, 36),
          metadata: data.metadata,
        })
        .execute()
        .catch((err: unknown) =>
          process.stderr.write(`[saveHttpLog] errorLogs insert failed: ${String(err)}\n`)
        );
    }
  } catch (err) {
    process.stderr.write(`[saveHttpLog] Failed: ${String(err)}\n`);
  }
}