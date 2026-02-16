import { Context, Next } from 'hono';
import { metricsService } from '@/config/metrics.config';
import { logger } from '@/config/logger.config';

/**
 * Metrics Middleware untuk Hono
 * Tracks HTTP request metrics automatically
 */
export async function metricsMiddleware(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const url = new URL(c.req.url);
  const path = url.pathname;

  await next();

  const duration = Date.now() - start;
  const statusCode = c.res.status;
  const route = extractRoute(path);
  const platform = extractPlatform(path);

  // Track HTTP request metrics
  try {
    metricsService.trackHttpRequest(method, route, statusCode, duration, platform);
  } catch (error) {
    logger.error({ err: error, method, route }, 'Failed to track HTTP metrics');
  }
}

/**
 * Create platform-specific metrics middleware
 */
export function createPlatformMetricsMiddleware(
  platform: 'web' | 'mobile' | 'admin'
) {
  return async (c: Context, next: Next): Promise<void> => {
    const start = Date.now();
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;

    await next();

    const duration = Date.now() - start;
    const statusCode = c.res.status;
    const route = extractRoute(path);

    try {
      // Force specific platform
      metricsService.trackHttpRequest(method, route, statusCode, duration, platform);
    } catch (error) {
      logger.error({ err: error, platform }, 'Failed to track platform metrics');
    }
  };
}

/**
 * Extract route pattern from path
 * Convert /api/v1/users/123 → /api/v1/users/:id
 */
function extractRoute(path: string): string {
  return (
    path
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id'
      )
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-z0-9]{20,}/gi, '/:id')
      .replace(/\/$/, '') || '/'
  );
}

/**
 * Extract platform from request path
 */
function extractPlatform(path: string): string {
  if (path.startsWith('/api/mobile/')) return 'mobile';
  if (path.startsWith('/api/web/')) return 'web';
  if (path.startsWith('/api/admin/')) return 'admin';

  if (path.includes('/v1/')) return 'web';
  if (path.includes('/v2/')) return 'web';

  return 'unknown';
}

/**
 * Extract platform from user-agent (optional enhancement)
 */
function extractPlatformFromUserAgent(userAgent?: string): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }

  if (ua.includes('postman') || ua.includes('insomnia')) {
    return 'api-client';
  }

  return 'web';
}

/**
 * Enhanced metrics middleware with user-agent detection
 */
export async function enhancedMetricsMiddleware(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const url = new URL(c.req.url);
  const path = url.pathname;
  const userAgent = c.req.header('user-agent');

  await next();

  const duration = Date.now() - start;
  const statusCode = c.res.status;
  const route = extractRoute(path);

  let platform = extractPlatform(path);
  if (platform === 'unknown') {
    platform = extractPlatformFromUserAgent(userAgent);
  }

  try {
    metricsService.trackHttpRequest(method, route, statusCode, duration, platform);
  } catch (error) {
    logger.error({ err: error, method, route }, 'Failed to track HTTP metrics');
  }
}

/**
 * Class-based Metrics Middleware (untuk @Middleware decorator)
 */
export class MetricsMiddleware {
  async use(c: Context, next: Next): Promise<void> {
    const start = Date.now();
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;

    await next();

    const duration = Date.now() - start;
    const statusCode = c.res.status;
    const route = extractRoute(path);
    const platform = extractPlatform(path);

    try {
      metricsService.trackHttpRequest(method, route, statusCode, duration, platform);
    } catch (error) {
      logger.error({ err: error, method, route }, 'Failed to track HTTP metrics');
    }
  }
}

/**
 * Metrics middleware with custom options
 */
export function createMetricsMiddleware(options?: {
  skipPaths?: string[];
  enhancedPlatformDetection?: boolean;
}) {
  const skipPaths = options?.skipPaths || ['/health', '/metrics'];
  const enhancedDetection = options?.enhancedPlatformDetection || false;

  return async (c: Context, next: Next): Promise<void> => {
    const path = c.req.url;

    if (skipPaths.some((skip) => path.includes(skip))) {
      return next();
    }

    if (enhancedDetection) {
      return enhancedMetricsMiddleware(c, next);
    }

    return metricsMiddleware(c, next);
  };
}