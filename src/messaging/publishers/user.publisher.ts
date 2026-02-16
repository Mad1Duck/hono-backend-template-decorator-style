import { getChannel } from '@/config/messaging.config';
import { logger } from '@/config/logger.config';
import { v4 as uuidv4 } from 'uuid';
import type { UserEvent } from '@/validation/messaging/user.messaging.validation';

/**
 * User Event Publisher
 * Publishes events to RabbitMQ
 */
export class UserPublisher {
  private readonly exchange = 'user.events';
  private readonly exchangeType = 'topic';

  constructor() {
    this.setupExchange();
  }

  /**
   * Setup RabbitMQ exchange
   */
  private async setupExchange() {
    try {
      const channel = getChannel();
      await channel.assertExchange(this.exchange, this.exchangeType, {
        durable: true,
      });

      logger.info({ exchange: this.exchange }, 'Exchange asserted');
    } catch (error) {
      logger.error({ error }, 'Failed to setup exchange');
    }
  }

  /**
   * Publish event
   */
  private async publish(routingKey: string, event: UserEvent) {
    try {
      const channel = getChannel();
      
      const message = Buffer.from(JSON.stringify(event));
      
      const published = channel.publish(
        this.exchange,
        routingKey,
        message,
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
          messageId: event.eventId,
        }
      );

      if (published) {
        logger.info(
          { eventId: event.eventId, routingKey, eventType: event.eventType },
          'Event published'
        );
      } else {
        logger.warn(
          { eventId: event.eventId, routingKey },
          'Event publish buffered'
        );
      }
    } catch (error) {
      logger.error({ error, event }, 'Failed to publish event');
      throw error;
    }
  }

  /**
   * Publish user created event
   */
  async publishCreated(userId: string, data: any) {
    const event: UserEvent = {
      eventId: uuidv4(),
      eventType: 'user.created',
      timestamp: Date.now(),
      version: '1.0',
      source: 'api',
      data: {
        userId,
        ...data,
      },
    };

    await this.publish('user.created', event);
  }

  /**
   * Publish user updated event
   */
  async publishUpdated(userId: string, changes: any, previousValues?: any) {
    const event: UserEvent = {
      eventId: uuidv4(),
      eventType: 'user.updated',
      timestamp: Date.now(),
      version: '1.0',
      source: 'api',
      data: {
        userId,
        changes,
        previousValues,
      },
    };

    await this.publish('user.updated', event);
  }

  /**
   * Publish user deleted event
   */
  async publishDeleted(userId: string, deletedBy?: string) {
    const event: UserEvent = {
      eventId: uuidv4(),
      eventType: 'user.deleted',
      timestamp: Date.now(),
      version: '1.0',
      source: 'api',
      data: {
        userId,
        deletedBy,
        softDelete: false,
      },
    };

    await this.publish('user.deleted', event);
  }
}
