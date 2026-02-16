import { z } from 'zod';

/**
 * User Messaging Validation Schemas
 * Validates event data for RabbitMQ publishers/consumers
 */

// Base event schema
const BaseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  timestamp: z.number(),
  version: z.string().default('1.0'),
  source: z.string(),
});

// User created event
export const UserCreatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('user.created'),
  data: z.object({
    userId: z.string().uuid(),
    name: z.string(),
    createdBy: z.string().uuid().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

// User updated event
export const UserUpdatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('user.updated'),
  data: z.object({
    userId: z.string().uuid(),
    changes: z.record(z.any()),
    updatedBy: z.string().uuid().optional(),
    previousValues: z.record(z.any()).optional(),
  }),
});

// User deleted event
export const UserDeletedEventSchema = BaseEventSchema.extend({
  eventType: z.literal('user.deleted'),
  data: z.object({
    userId: z.string().uuid(),
    deletedBy: z.string().uuid().optional(),
    softDelete: z.boolean().default(false),
  }),
});

// Union of all event types
export const UserEventSchema = z.discriminatedUnion('eventType', [
  UserCreatedEventSchema,
  UserUpdatedEventSchema,
  UserDeletedEventSchema,
]);

// Export types
export type UserEvent = z.infer<typeof UserEventSchema>;
export type UserCreatedEvent = z.infer<typeof UserCreatedEventSchema>;
export type UserUpdatedEvent = z.infer<typeof UserUpdatedEventSchema>;
export type UserDeletedEvent = z.infer<typeof UserDeletedEventSchema>;

/**
 * Validate event data
 */
export function validateUserEvent(data: unknown): UserEvent {
  return UserEventSchema.parse(data);
}
