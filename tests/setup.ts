import { beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { logger } from '@/config/logger.config';

/**
 * Global test setup
 * Runs before all tests
 */
beforeAll(async () => {
  logger.info('🧪 Setting up test environment');

  // Set test environment
  process.env.NODE_ENV = 'test';

  // TODO: Run database migrations
  // await migrate(db, { migrationsFolder: './drizzle' });

  logger.info('✅ Test environment ready');
});

/**
 * Global test teardown
 * Runs after all tests
 */
afterAll(async () => {
  logger.info('🧹 Cleaning up test environment');

  // TODO: Close database connections
  // await db.$client.end();

  logger.info('✅ Test environment cleaned');
});
