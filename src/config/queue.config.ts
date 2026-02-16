import { ConnectionOptions } from 'bullmq';
import { env } from './env.config';

/**
 * Queue Redis Connection
 * Separated from cache Redis for isolation
 */
export const queueRedisConnection: ConnectionOptions = {
  host: env.REDIS_QUEUE_HOST,
  port: env.REDIS_QUEUE_PORT,
  password: env.REDIS_QUEUE_PASSWORD,
  db: 1,
};

/**
 * Default queue options
 */
export const defaultQueueOptions = {
  connection: queueRedisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
};

/**
 * Default worker options
 */
export const defaultWorkerOptions = {
  connection: queueRedisConnection,
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 1000,
  },
};
