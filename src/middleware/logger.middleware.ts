import type { Context, Next } from 'hono';
import { createLogger, logConfig, saveHttpLog } from '@/config/logger.config';
import type { MiddlewareClass } from '@/decorators/middleware';
import type { RateLimitResult } from '@/middleware/rateLimit.middleware';

const log = createLogger('HTTP');

/* ================= CLASS-BASED (untuk @Middleware) ================= */
export class LoggerMiddleware implements MiddlewareClass {
  async use(c: Context, next: Next): Promise<Response | void> {
    const start = Date.now();

    const reqData = {
      id: c.req.header('x-request-id'),
      method: c.req.method,
      url: c.req.url,
      path: new URL(c.req.url).pathname,
      headers: {
        host: c.req.header('host'),
        userAgent: c.req.header('user-agent'),
        ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
          c.req.header('x-real-ip') ||
          c.req.header('cf-connecting-ip') ||
          'unknown',
      },
    };

    log.info({ req: reqData }, 'Incoming request');

    try {
      await next();
    } catch (error) {
      const duration = Date.now() - start;

      log.error(
        {
          req: reqData,
          duration,
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : 'Error',
          },
        },
        'Request error - exception thrown'
      );

      throw error;
    }

    const duration = Date.now() - start;
    const statusCode = c.res.status;

    const rateLimit = c.get('rateLimit') as RateLimitResult | undefined;

    const logData = {
      req: reqData,
      res: {
        statusCode,
        headers: {
          'content-type': c.res.headers.get('content-type'),
          'x-ratelimit-remaining': c.res.headers.get('x-ratelimit-remaining'),
          'x-ratelimit-limit': c.res.headers.get('x-ratelimit-limit'),
          'retry-after': c.res.headers.get('retry-after'),
        },
      },
      duration,
      userId: (c.get('user') as { userId?: string; } | undefined)?.userId,
      ...(rateLimit && {
        rateLimit: {
          remaining: rateLimit.remaining,
          limit: rateLimit.limit,
          resetTime: new Date(rateLimit.resetTime).toISOString(),
        },
      }),
    };

    const hasActivityLog = c.get('hasActivityLog') as boolean | undefined;

    if (logConfig.toDb && !hasActivityLog && statusCode > 0 && !reqData.path.includes("/favicon.ico")) {
      const user = c.get('user') as { userId?: string; id?: string; } | undefined;

      void saveHttpLog({
        requestId: reqData.id,
        method: reqData.method,
        url: reqData.url,
        path: reqData.path,
        userAgent: reqData.headers.userAgent,
        host: reqData.headers.host,
        statusCode: statusCode,
        duration: duration,
        userId: user?.userId || user?.id,
        action: `HTTP_${reqData.method}`,
        message: `${reqData.method} ${reqData.path}`,
        metadata: {
          ...logData,
          ip: reqData.headers.ip,
        },
      }).catch((err) => {
        process.stderr.write(`[LoggerMiddleware] Failed to save log: ${String(err)}\n`);
      });
    }

    if (statusCode === 429) {
      log.warn(logData, 'Rate limit exceeded');
    } else if (statusCode >= 500) {
      log.error(logData, 'Request failed - server error');
    } else if (statusCode === 401) {
      log.warn(logData, 'Request error - unauthorized');
    } else if (statusCode === 403) {
      log.warn(logData, 'Request error - forbidden');
    } else if (statusCode >= 400) {
      log.warn(logData, 'Request error - client error');
    } else {
      log.info(logData, 'Request completed');
    }
  }
}

/* ================= FUNCTION-BASED (untuk app.use() global) ================= */
export function honoLoggerMiddleware() {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const instance = new LoggerMiddleware();
    return instance.use(c, next);
  };
}