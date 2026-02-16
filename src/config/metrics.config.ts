// config/metrics.config.ts
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ prefix: 'app_' });

/* ==================== HTTP METRICS ==================== */

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'platform'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'platform'],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type', 'platform'],
});

/* ==================== RATE LIMIT METRICS ==================== */

export const rateLimitHitsTotal = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits (429 responses)',
  labelNames: ['key_prefix', 'path', 'identifier_type'],
});

export const rateLimitRequestsTotal = new Counter({
  name: 'rate_limit_requests_total',
  help: 'Total number of requests checked by rate limiter',
  labelNames: ['key_prefix', 'path', 'result'],
});

export const rateLimitRemainingGauge = new Gauge({
  name: 'rate_limit_remaining',
  help: 'Remaining requests before rate limit',
  labelNames: ['key_prefix', 'identifier'],
});

/* ==================== METHOD METRICS ==================== */

export const methodDuration = new Histogram({
  name: 'method_duration_seconds',
  help: 'Duration of method execution',
  labelNames: ['class', 'method', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10],
});

export const methodCallsTotal = new Counter({
  name: 'method_calls_total',
  help: 'Total number of method calls',
  labelNames: ['class', 'method', 'status'],
});

/* ==================== DATABASE METRICS ==================== */

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
});

export const dbQueryTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
});

export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
});

export const dbConnectionsIdle = new Gauge({
  name: 'db_connections_idle',
  help: 'Number of idle database connections',
});

/* ==================== QUEUE METRICS ==================== */

export const queueJobsProcessed = new Counter({
  name: 'queue_jobs_processed_total',
  help: 'Total number of queue jobs processed',
  labelNames: ['queue', 'status'],
});

export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'job_type'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
});

export const queueJobsActive = new Gauge({
  name: 'queue_jobs_active',
  help: 'Number of active queue jobs',
  labelNames: ['queue'],
});

export const queueJobsWaiting = new Gauge({
  name: 'queue_jobs_waiting',
  help: 'Number of waiting queue jobs',
  labelNames: ['queue'],
});

/* ==================== CACHE METRICS ==================== */

export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type', 'key_pattern'],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type', 'key_pattern'],
});

export const cacheOperationDuration = new Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Duration of cache operations',
  labelNames: ['operation', 'cache_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

/* ==================== BUSINESS METRICS ==================== */

export const userRegistrations = new Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['platform'],
});

export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of active users',
  labelNames: ['platform'],
});

export const orderTotal = new Counter({
  name: 'order_total',
  help: 'Total number of orders',
  labelNames: ['status', 'platform'],
});

export const orderAmount = new Counter({
  name: 'order_amount_total',
  help: 'Total order amount in currency',
  labelNames: ['currency', 'platform'],
});

// Export registry
export { register };

/* ==================== METRICS SERVICE ==================== */

/**
 * Service untuk tracking metrics dengan Prometheus
 */
export class MetricsService {
  /**
   * Track method duration (dipakai oleh @TrackMetrics decorator)
   */
  trackMethodDuration(
    name: string,
    duration: number,
    status: 'success' | 'error'
  ): void {
    const [className, methodName] = name.split('.');

    if (!className || !methodName) {
      console.warn(`[MetricsService] Invalid metric name: ${name}`);
      return;
    }

    methodDuration.observe(
      { class: className, method: methodName, status },
      duration / 1000
    );

    methodCallsTotal.inc({ class: className, method: methodName, status });
  }

  /**
   * Track HTTP request
   */
  trackHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    platform: string = 'web'
  ): void {
    const statusCodeStr = statusCode.toString();

    httpRequestDuration.observe(
      { method, route, status_code: statusCodeStr, platform },
      duration / 1000
    );

    httpRequestTotal.inc({ method, route, status_code: statusCodeStr, platform });

    if (statusCode >= 400) {
      const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
      httpRequestErrors.inc({ method, route, error_type: errorType, platform });
    }
  }

  /* ==================== RATE LIMIT TRACKING ==================== */

  /**
   * Track rate limit hit (429 response)
   */
  trackRateLimitHit(keyPrefix: string, path: string, identifierType: string = 'ip'): void {
    rateLimitHitsTotal.inc({
      key_prefix: keyPrefix,
      path,
      identifier_type: identifierType,
    });
  }

  /**
   * Track rate limit check result
   */
  trackRateLimitCheck(
    keyPrefix: string,
    path: string,
    result: 'allowed' | 'blocked' | 'whitelisted'
  ): void {
    rateLimitRequestsTotal.inc({
      key_prefix: keyPrefix,
      path,
      result,
    });
  }

  /**
   * Set remaining rate limit requests
   */
  setRateLimitRemaining(keyPrefix: string, identifier: string, remaining: number): void {
    rateLimitRemainingGauge.set(
      { key_prefix: keyPrefix, identifier },
      remaining
    );
  }

  /* ==================== DATABASE TRACKING ==================== */

  trackDbQuery(
    operation: string,
    table: string,
    duration: number,
    status: 'success' | 'error'
  ): void {
    dbQueryDuration.observe({ operation, table, status }, duration / 1000);
    dbQueryTotal.inc({ operation, table, status });
  }

  setDbConnectionsActive(count: number): void {
    dbConnectionsActive.set(count);
  }

  setDbConnectionsIdle(count: number): void {
    dbConnectionsIdle.set(count);
  }

  /* ==================== QUEUE TRACKING ==================== */

  trackQueueJob(
    queue: string,
    jobType: string,
    duration: number,
    status: 'success' | 'error'
  ): void {
    queueJobDuration.observe({ queue, job_type: jobType }, duration / 1000);
    queueJobsProcessed.inc({ queue, status });
  }

  setQueueJobsActive(queue: string, count: number): void {
    queueJobsActive.set({ queue }, count);
  }

  setQueueJobsWaiting(queue: string, count: number): void {
    queueJobsWaiting.set({ queue }, count);
  }

  /* ==================== CACHE TRACKING ==================== */

  trackCacheHit(cacheType: string, keyPattern: string): void {
    cacheHits.inc({ cache_type: cacheType, key_pattern: keyPattern });
  }

  trackCacheMiss(cacheType: string, keyPattern: string): void {
    cacheMisses.inc({ cache_type: cacheType, key_pattern: keyPattern });
  }

  trackCacheOperation(
    operation: 'get' | 'set' | 'delete',
    cacheType: string,
    duration: number
  ): void {
    cacheOperationDuration.observe(
      { operation, cache_type: cacheType },
      duration / 1000
    );
  }

  /* ==================== BUSINESS TRACKING ==================== */

  trackUserRegistration(platform: string = 'web'): void {
    userRegistrations.inc({ platform });
  }

  setActiveUsers(count: number, platform: string = 'web'): void {
    activeUsers.set({ platform }, count);
  }

  trackOrder(status: 'pending' | 'completed' | 'cancelled', platform: string = 'web'): void {
    orderTotal.inc({ status, platform });
  }

  trackOrderAmount(amount: number, currency: string = 'USD', platform: string = 'web'): void {
    orderAmount.inc({ currency, platform }, amount);
  }
}

export const metricsService = new MetricsService();