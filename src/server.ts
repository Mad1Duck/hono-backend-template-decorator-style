// server.ts (or app.ts)
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

import { env } from './config/env.config';
import { honoLoggerMiddleware } from './middleware/logger.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';
import { corsMiddleware, securityHeadersMiddleware } from './config/security.config';
import { register } from './config/metrics.config';
import { logCleaner } from './config/logger.cleaner';
import webRoutes from './platforms/web/routes';
import { apiLimiter } from './middleware/rateLimit.middleware';

/* ================= BOOTSTRAP ================= */

function bootstrap(): Hono {
  const app = new Hono();

  /* ==================================================
   * 1️⃣ REQUEST ID (for tracing)
   * ================================================== */
  app.use('*', requestId());

  /* ==================================================
   * 2️⃣ LOGGER
   * ================================================== */
  app.use('*', honoLoggerMiddleware());

  /* ==================================================
   * 3️⃣ CORS (must be before security headers)
   * ================================================== */
  app.use('/api/*', (c, next) => apiLimiter.middleware(c, next));

  /* ==================================================
   * 3️⃣ CORS (must be before security headers)
   * ================================================== */
  app.use('*', corsMiddleware);

  /* ==================================================
   * 4️⃣ SECURITY HEADERS
   * ================================================== */
  app.use('*', securityHeadersMiddleware);

  /* ==================================================
   * 5️⃣ METRICS (exclude health & prometheus endpoints)
   * ================================================== */
  app.use('*', async (c, next) => {
    const path = c.req.path;

    // Skip metrics tracking for these endpoints
    if (path === '/health' || path === '/metrics') {
      return next();
    }

    return metricsMiddleware(c, next);
  });

  /* ==================================================
   * 6️⃣ HEALTH CHECK (NO METRICS)
   * ================================================== */
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: env.NODE_ENV,
    });
  });

  /* ==================================================
   * 7️⃣ PROMETHEUS METRICS ENDPOINT (NO TRACKING)
   * ================================================== */
  app.get('/metrics', async (c) => {
    try {
      const metrics = await register.metrics();

      return c.text(metrics, 200, {
        'Content-Type': register.contentType,
      });
    } catch (error) {
      console.error('[Metrics] Failed to generate metrics:', error);

      return c.text('Error generating metrics', 500);
    }
  });

  /* ==================================================
   * 8️⃣ API ROUTES
   * ================================================== */
  app.route('/api', webRoutes);

  /* ==================================================
   * 9️⃣ NOT FOUND HANDLER
   * ================================================== */
  app.notFound((c) =>
    c.json(
      {
        status: 'error',
        error: {
          code: 'NOT_FOUND',
          message: `Route not found: ${c.req.method} ${c.req.path}`,
          path: c.req.path,
        },
      },
      404
    )
  );

  /* ==================================================
   * 🔟 GLOBAL ERROR HANDLER
   * ================================================== */
  app.onError((err, c) => {
    console.error('[UNHANDLED ERROR]', {
      error: err.message,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
    });

    // Handle CORS errors
    if (err.message.includes('CORS') || err.message.includes('origin')) {
      return c.json(
        {
          status: 'error',
          error: {
            code: 'CORS_ERROR',
            message: 'Origin not allowed',
          },
        },
        403
      );
    }

    // Generic error response
    return c.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: env.NODE_ENV === 'development'
            ? err.message
            : 'Internal server error',
          ...(env.NODE_ENV === 'development' && { stack: err.stack }),
        },
      },
      500
    );
  });

  /* ==================================================
   * 1️⃣1️⃣ BACKGROUND JOBS
   * ================================================== */
  logCleaner.start();

  /* ==================================================
   * 1️⃣2️⃣ GRACEFUL SHUTDOWN
   * ================================================== */
  const shutdown = async () => {
    console.log('🛑 Shutting down gracefully...');

    await logCleaner.stop();

    // Close database connections (if any)
    // await db.close();

    console.log('✅ Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return app;
}

/* ================= START SERVER ================= */

const app = bootstrap();

Bun.serve({
  fetch: app.fetch,
  port: env.PORT || 3000,
  development: env.NODE_ENV === 'development',
});

console.log('');
console.log('🚀 Server started successfully!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📡 Environment: ${env.NODE_ENV}`);
console.log(`🔌 Port: ${env.PORT}`);
console.log('');
console.log('📍 Endpoints:');
console.log(`   💻 Web API:    http://localhost:${env.PORT}/api/web/v1`);
console.log(`   📱 Mobile API: http://localhost:${env.PORT}/api/mobile/v1`);
console.log(`   📊 Metrics:    http://localhost:${env.PORT}/metrics`);
console.log(`   ❤️  Health:    http://localhost:${env.PORT}/health`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');