import { z } from 'zod';

/**
 * User Queue Validation Schemas
 * Validates job data for BullMQ workers
 */

// Job data schema
export const UserJobDataSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['create', 'update', 'delete', 'sync', 'notify']),
  data: z.record(z.any()).optional(),
  metadata: z.object({
    triggeredBy: z.string(),
    timestamp: z.number(),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    retryCount: z.number().default(0),
  }),
});

export type UserJobData = z.infer<typeof UserJobDataSchema>;

// Job result schema
export const UserJobResultSchema = z.object({
  success: z.boolean(),
  userId: z.string().uuid(),
  action: z.string(),
  processedAt: z.number(),
  duration: z.number(),
  error: z.string().optional(),
});

export type UserJobResult = z.infer<typeof UserJobResultSchema>;

/**
 * Validate job data
 */
export function validateUserJobData(data: unknown): UserJobData {
  return UserJobDataSchema.parse(data);
}
