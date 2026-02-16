import { Context, Next } from 'hono';
import { cacheRedis } from '@/config/cache.config';
import { env } from '@/config/env.config';
import { logConfig, logger, saveHttpLog } from '@/config/logger.config';
import { metricsService } from '@/config/metrics.config';

// ==================== TYPES ====================

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  skipPaths?: string[];
  message?: string;
  keyGenerator?: (c: Context) => string;
  whitelist?: string[];
  dynamicMax?: (c: Context) => number;
  skipIfDecoratorPresent: false;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

// ==================== CORE ====================

export class RateLimiter {
  private windowMs: number;
  private max: number;
  private keyPrefix: string;
  private skipPaths: string[];
  private message: string;
  private keyGenerator: (c: Context) => string;
  private whitelist: Set<string>;
  private dynamicMax?: (c: Context) => number;
  private skipIfDecoratorPresent: boolean;

  constructor(opts: RateLimiterOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
    this.keyPrefix = opts.keyPrefix ?? 'rl:';
    this.skipPaths = opts.skipPaths ?? ['/health', '/metrics'];
    this.message = opts.message ?? 'Too many requests, please try again later.';
    this.keyGenerator = opts.keyGenerator ?? this.defaultKeyGenerator;
    this.whitelist = new Set(opts.whitelist || []);
    this.dynamicMax = opts.dynamicMax;
    this.skipIfDecoratorPresent = opts.skipIfDecoratorPresent ?? true;
  }

  private defaultKeyGenerator(c: Context): string {
    return (
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      'unknown'
    );
  }

  shouldSkip(path: string): boolean {
    return this.skipPaths.some((p) => path.startsWith(p));
  }

  isWhitelisted(identifier: string): boolean {
    return this.whitelist.has(identifier);
  }

  getMaxLimit(c?: Context): number {
    if (this.dynamicMax && c) {
      return this.dynamicMax(c);
    }
    return this.max;
  }

  async check(identifier: string, maxOverride?: number): Promise<RateLimitResult> {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Date.now();
    const start = now - this.windowMs;
    const effectiveMax = maxOverride ?? this.max;

    try {
      const pipeline = cacheRedis.pipeline();
      pipeline.zremrangebyscore(key, 0, start);
      pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
      pipeline.zcard(key);
      pipeline.pexpire(key, this.windowMs);

      const results = await pipeline.exec();
      const current = (results?.[2]?.[1] as number) ?? 1;

      return {
        allowed: current <= effectiveMax,
        current,
        limit: effectiveMax,
        remaining: Math.max(0, effectiveMax - current),
        resetTime: now + this.windowMs,
        retryAfter: Math.ceil(this.windowMs / 1000),
      };
    } catch (error) {
      logger.error({ err: error, identifier }, 'Rate limiter Redis error - failing open');
      return {
        allowed: true,
        current: 0,
        limit: effectiveMax,
        remaining: effectiveMax,
        resetTime: now + this.windowMs,
        retryAfter: Math.ceil(this.windowMs / 1000),
      };
    }
  }

  async middleware(c: Context, next: Next): Promise<Response | void> {
    const path = c.req.path;
    const start = Date.now();

    if (this.shouldSkip(path)) {
      return next();
    }

    // const hasDecoratorRateLimit = c.get('hasDecoratorRateLimit') as boolean | undefined;
    // if (this.skipIfDecoratorPresent && hasDecoratorRateLimit) {
    //   logger.debug(
    //     { path, keyPrefix: this.keyPrefix },
    //     'Skipping middleware rate limit: Decorator rate limit active'
    //   );
    //   return next();
    // }

    const identifier = this.keyGenerator(c);

    if (this.isWhitelisted(identifier)) {
      logger.debug({ identifier, path }, 'Rate limit bypassed: Whitelisted');
      return next();
    }

    const maxLimit = this.getMaxLimit(c);
    const result = await this.check(identifier, maxLimit);

    c.header('X-RateLimit-Limit', result.limit.toString());
    c.header('X-RateLimit-Remaining', result.remaining.toString());
    c.header('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      const duration = Date.now() - start;
      c.header('Retry-After', result.retryAfter.toString());

      logger.warn(
        {
          identifier,
          path,
          current: result.current,
          limit: result.limit,
          keyPrefix: this.keyPrefix,
        },
        'Rate limit exceeded'
      );

      metricsService.trackRateLimitHit(this.keyPrefix, path);

      if (logConfig.toDb) {
        const user = c.get('user') as { userId?: string; id?: string; } | undefined;

        void saveHttpLog({
          requestId: c.req.header('x-request-id'),
          method: c.req.method,
          url: c.req.url,
          path: path,
          userAgent: c.req.header('user-agent'),
          host: c.req.header('host'),
          statusCode: 429,
          duration: duration,
          userId: user?.userId || user?.id,
          action: 'RATE_LIMIT_EXCEEDED',
          controller: 'RateLimiter',
          handler: this.keyPrefix,
          message: this.message,
          metadata: {
            keyPrefix: this.keyPrefix,
            identifier: identifier,
            current: result.current,
            limit: result.limit,
            remaining: result.remaining,
            resetTime: new Date(result.resetTime).toISOString(),
          },
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: this.message,
          },
        }).catch((err) => {
          process.stderr.write(`[RateLimiter] Failed to save log: ${String(err)}\n`);
        });
      }

      return c.json(
        {
          status: 'error',
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: this.message,
            retryAfter: result.retryAfter,
            resetTime: new Date(result.resetTime).toISOString(),
          },
        },
        429
      );
    }

    if (result.remaining < 5) {
      logger.debug(
        { identifier, path, remaining: result.remaining },
        'Rate limit warning: Low remaining requests'
      );
    }

    c.set('rateLimit', result);

    return next();
  }

  errorPayload(result: RateLimitResult, code = 'RATE_LIMIT_EXCEEDED') {
    return {
      status: 'error',
      error: {
        code,
        message: this.message,
        retryAfter: result.retryAfter,
        resetTime: new Date(result.resetTime).toISOString(),
      },
    };
  }
}

// ==================== PRE-BUILT INSTANCES ====================

/**
 * Global API rate limiter
 * Runs BEFORE decorator limiters (decorator can be stricter)
 */
export const apiLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_MAX || 100,
  keyPrefix: 'rl:global:',
  message: 'API rate limit exceeded. Please try again later.',
  whitelist: env.RATE_LIMIT_WHITELIST?.split(','),
  skipIfDecoratorPresent: false,
});

/**
 * Authentication rate limiter
 */
export const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: 'rl:auth:',
  message: 'Too many authentication attempts. Please try again later.',
  skipIfDecoratorPresent: false,
});

/**
 * User-specific rate limiter
 */
export const userLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: 'rl:user:',
  keyGenerator: (c) => {
    const user = c.get('user') as { id?: string; } | undefined;
    return user?.id || 'anonymous';
  },
  dynamicMax: (c) => {
    const user = c.get('user') as { tier?: string; } | undefined;
    const limits = { free: 60, pro: 600, enterprise: 6000 };
    return limits[user?.tier as keyof typeof limits] || 60;
  },
  skipIfDecoratorPresent: false,
});

/**
 * Endpoint-specific rate limiter
 */
export const endpointLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: 'rl:endpoint:',
  keyGenerator: (c) => {
    const ip = c.req.header('x-forwarded-for') || 'unknown';
    const path = c.req.path;
    return `${ip}:${path}`;
  },
  skipIfDecoratorPresent: false
});

/**
 * Create custom rate limiter middleware
 */
export function createRateLimiter(opts: RateLimiterOptions) {
  const limiter = new RateLimiter(opts);
  return limiter.middleware.bind(limiter);
}