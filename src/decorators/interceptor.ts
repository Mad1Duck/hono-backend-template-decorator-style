import 'reflect-metadata';
import {
  METADATA_KEYS,
  CacheMetadata,
} from './metadata';
import { createLogger, logConfig } from '@/config/logger.config';
import { Context } from 'hono';
import { activityLogs, db, errorLogs, httpLogs } from '@/db';

/* ================= TYPES ================= */

type AnyMethod = (...args: unknown[]) => unknown;

type LoggerLike = {
  info?: (data: unknown, message?: string) => void;
  error?: (data: unknown, message?: string) => void;
  warn?: (data: unknown, message?: string) => void;
};

type MetricsLike = {
  trackMethodDuration?: (
    name: string,
    duration: number,
    status: 'success' | 'error'
  ) => void;
};

/* ================= CACHE ================= */

export function Cache(
  options: CacheMetadata
): MethodDecorator {
  return <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    Reflect.defineMetadata(
      METADATA_KEYS.CACHE,
      options,
      target,
      propertyKey
    );

    return descriptor;
  };
}

/* ================= TYPES ================= */

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

function toLevel(statusCode: number, hasError: boolean): LogLevel {
  if (hasError || statusCode >= 500) return 'ERROR';
  if (statusCode >= 400) return 'WARN';
  return 'INFO';
}

/* ================= LOG ACTIVITY ================= */

export function LogActivity(
  action: string,
  options?: { includeBody?: boolean; includeResult?: boolean; }
): MethodDecorator {
  return <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const original = descriptor.value as AnyMethod | undefined;
    if (!original) return descriptor;

    descriptor.value = (async function (
      this: { logger?: LoggerLike; __ctx?: Context; },
      ...args: unknown[]
    ) {
      const start = Date.now();
      const log = this.logger ?? createLogger(target.constructor.name);

      const c = this.__ctx;

      if (c) {
        c.set('hasActivityLog', true);
      }

      const reqData = c
        ? {
          method: c.req.method,
          url: c.req.url,
          path: new URL(c.req.url).pathname,
          userAgent: c.req.header('user-agent'),
          host: c.req.header('host'),
          requestId: c.req.header('x-request-id'),
        }
        : undefined;

      log.info?.(
        {
          action,
          handler: String(propertyKey),
          controller: target.constructor.name,
          args: options?.includeBody ? args : undefined,
        },
        `Activity: ${action}`
      );

      let result: unknown;
      let caughtError: unknown;
      const before = options?.includeBody ? args[0] : undefined;

      try {
        result = await original.apply(this, args);
      } catch (err) {
        caughtError = err;
      }

      const duration = Date.now() - start;
      const statusCode = caughtError ? 500 : (c?.res?.status ?? 200);
      const hasError = !!caughtError || statusCode >= 500;
      const level = toLevel(statusCode, hasError);
      const userId = toUuid(
        (c?.get('user') as { userId?: string; } | undefined)?.userId
      );

      if (hasError) {
        log.error?.({ action, duration, statusCode, error: String(caughtError) }, `Activity failed: ${action}`);
      } else {
        log.info?.({ action, duration, statusCode }, `Activity completed: ${action}`);
      }

      if (logConfig.toDb) {
        void saveAllLogs({
          action,
          controller: target.constructor.name,
          handler: String(propertyKey),
          reqData,
          statusCode,
          duration,
          userId,
          level,
          before,
          after: options?.includeResult ? result : undefined,
          success: !hasError,
          error: caughtError,
          metadata: { action, handler: String(propertyKey), statusCode, duration },
        }).catch((err) =>
          process.stderr.write(`[LogActivity] DB write failed: ${String(err)}\n`)
        );
      }

      if (caughtError) throw caughtError;
      return result;
    }) as T;

    return descriptor;
  };
}

/* ================= HELPER ================= */

interface SaveLogsPayload {
  action: string;
  controller: string;
  handler: string;
  reqData?: {
    method: string;
    url: string;
    path: string;
    userAgent?: string;
    host?: string;
    requestId?: string;
  };
  statusCode: number;
  duration: number;
  userId?: string;
  level: LogLevel;
  before?: unknown;
  after?: unknown;
  success: boolean;
  error?: unknown;
  metadata?: unknown;
}

async function saveAllLogs(data: SaveLogsPayload): Promise<void> {
  const method = data.reqData ? toMethod(data.reqData.method) : 'GET';
  const url = data.reqData?.url ?? '';
  const pathStr = data.reqData?.path ?? '';

  const [httpLog] = await db
    .insert(httpLogs)
    .values({
      requestId: data.reqData?.requestId?.slice(0, 36),
      method,
      url,
      path: pathStr,
      userAgent: data.reqData?.userAgent,
      host: data.reqData?.host,
      statusCode: data.statusCode,
      duration: data.duration,
      userId: data.userId,
      action: data.action.slice(0, 100),
      controller: data.controller.slice(0, 100),
      handler: data.handler.slice(0, 100),
      level: data.level,
      message: `Activity: ${data.action}`,
      metadata: data.metadata,
    })
    .returning({ id: httpLogs.id });

  const httpLogId = httpLog?.id;

  void db
    .insert(activityLogs)
    .values({
      httpLogId,
      userId: data.userId,
      action: data.action.slice(0, 100),
      resource: data.controller.slice(0, 100),
      before: data.before ?? null,
      after: data.after ?? null,
      metadata: data.metadata,
      success: data.success,
      errorMessage: data.error ? String(data.error).slice(0, 500) : undefined,
    })
    .execute()
    .catch((err: unknown) =>
      process.stderr.write(`[LogActivity] activityLogs insert failed: ${String(err)}\n`)
    );

  if (!data.success && data.error) {
    const err = data.error instanceof Error
      ? data.error
      : new Error(String(data.error));

    void db
      .insert(errorLogs)
      .values({
        httpLogId,
        errorCode: 'APP_ERROR',
        errorMessage: err.message,
        errorStack: err.stack,
        errorName: err.name.slice(0, 100),
        controller: data.controller.slice(0, 100),
        handler: data.handler.slice(0, 100),
        userId: data.userId,
        requestId: data.reqData?.requestId?.slice(0, 36),
        metadata: data.metadata,
      })
      .execute()
      .catch((insertErr: unknown) =>
        process.stderr.write(`[LogActivity] errorLogs insert failed: ${String(insertErr)}\n`)
      );
  }
}
/* ================= TRACK METRICS ================= */

export function TrackMetrics(options?: { name?: string; }): MethodDecorator {
  return <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const original = descriptor.value as AnyMethod | undefined;
    if (!original) return descriptor;

    descriptor.value = (async function (
      this: { metrics?: MetricsLike; },
      ...args: unknown[]
    ) {
      const start = Date.now();
      const metricName =
        options?.name ??
        `${target.constructor.name}.${String(propertyKey)}`;

      try {
        const result = await original.apply(this, args);
        this.metrics?.trackMethodDuration?.(metricName, Date.now() - start, 'success');
        return result;
      } catch (error) {
        this.metrics?.trackMethodDuration?.(metricName, Date.now() - start, 'error');
        throw error;
      }
    }) as T;

    return descriptor;
  };
}

/* ================= TRANSFORM ================= */

export function Transform<TInput, TOutput>(
  transformer: (data: TInput) => TOutput
): MethodDecorator {
  return <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const original = descriptor.value as
      | AnyMethod
      | undefined;

    if (!original) return descriptor;

    descriptor.value = (async function (
      this: unknown,
      ...args: unknown[]
    ) {
      const result =
        (await original.apply(
          this,
          args
        )) as TInput;

      return transformer(result);
    }) as T;

    return descriptor;
  };
}

/* ================= RETRY ================= */

export function Retry(options: {
  attempts: number;
  delay?: number;
  backoff?: 'exponential' | 'linear';
}): MethodDecorator {
  return <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const original = descriptor.value as
      | AnyMethod
      | undefined;

    if (!original) return descriptor;

    descriptor.value = (async function (
      this: unknown,
      ...args: unknown[]
    ) {
      let lastError: unknown;

      for (
        let attempt = 1;
        attempt <= options.attempts;
        attempt++
      ) {
        try {
          return await original.apply(
            this,
            args
          );
        } catch (error) {
          lastError = error;

          if (
            attempt < options.attempts
          ) {
            const baseDelay =
              options.delay ?? 1000;

            const waitTime =
              options.backoff ===
                'exponential'
                ? baseDelay *
                Math.pow(
                  2,
                  attempt - 1
                )
                : baseDelay * attempt;

            await new Promise<void>(
              (resolve) =>
                setTimeout(
                  resolve,
                  waitTime
                )
            );
          }
        }
      }

      throw lastError;
    }) as T;

    return descriptor;
  };
}

/* ================= TIMEOUT ================= */

export function Timeout(
  ms: number
): MethodDecorator {
  return <T>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const original = descriptor.value as
      | AnyMethod
      | undefined;

    if (!original) return descriptor;

    descriptor.value = (async function (
      this: unknown,
      ...args: unknown[]
    ) {
      return Promise.race([
        original.apply(this, args),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Timeout after ${ms}ms`
                )
              ),
            ms
          )
        ),
      ]);
    }) as T;

    return descriptor;
  };
}