import { getChannel } from '@/config/messaging.config';
import { logger } from '@/config/logger.config';
import { ConsumeMessage } from 'amqplib';
import { validateRegionEvent, type RegionEvent } from '@/validation/messaging/region.messaging.validation';

/**
 * Region Event Consumer
 * Consumes events from RabbitMQ
 */
export class RegionConsumer {
  private readonly exchange = 'region.events';
  private readonly queue = 'region.consumer.queue';

  constructor() {
    this.setupQueue();
  }

  /**
   * Setup RabbitMQ queue and bindings
   */
  private async setupQueue() {
    try {
      const channel = getChannel();

      // Assert exchange
      await channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });

      // Assert queue
      await channel.assertQueue(this.queue, {
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 hours
          'x-max-length': 10000,
        },
      });

      // Bind queue to routing keys
      await channel.bindQueue(this.queue, this.exchange, 'region.created');
      await channel.bindQueue(this.queue, this.exchange, 'region.updated');
      await channel.bindQueue(this.queue, this.exchange, 'region.deleted');

      logger.info({ queue: this.queue }, 'Consumer queue setup complete');

      // Start consuming
      this.consume();
    } catch (error) {
      logger.error({ error }, 'Failed to setup consumer queue');
    }
  }

  /**
   * Start consuming messages
   */
  private async consume() {
    try {
      const channel = getChannel();

      await channel.consume(
        this.queue,
        this.handleMessage.bind(this),
        {
          noAck: false,
        }
      );

      logger.info({ queue: this.queue }, 'Started consuming messages');
    } catch (error) {
      logger.error({ error }, 'Failed to start consuming');
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg) return;

    const channel = getChannel();

    try {
      // Parse message
      const content = msg.content.toString();
      const rawEvent = JSON.parse(content);

      // Validate event
      const event = validateRegionEvent(rawEvent);

      logger.info(
        { eventId: event.eventId, eventType: event.eventType },
        'Processing event'
      );

      // Route to appropriate handler
      switch (event.eventType) {
        case 'region.created':
          await this.handleCreated(event);
          break;
        
        case 'region.updated':
          await this.handleUpdated(event);
          break;
        
        case 'region.deleted':
          await this.handleDeleted(event);
          break;
      }

      // Acknowledge message
      channel.ack(msg);

      logger.info({ eventId: event.eventId }, 'Event processed successfully');
    } catch (error) {
      logger.error({ error, msgId: msg.properties.messageId }, 'Failed to process event');

      // Reject and requeue (with limit)
      const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
      
      if (retryCount < 3) {
        channel.reject(msg, true);
      } else {
        // Dead letter after 3 retries
        channel.reject(msg, false);
        logger.warn({ msgId: msg.properties.messageId }, 'Message sent to dead letter');
      }
    }
  }

  /**
   * Handle created event
   */
  private async handleCreated(event: RegionEvent) {
    logger.debug({ eventId: event.eventId }, 'Handling created event');
    // Implement your logic here
  }

  /**
   * Handle updated event
   */
  private async handleUpdated(event: RegionEvent) {
    logger.debug({ eventId: event.eventId }, 'Handling updated event');
    // Implement your logic here
  }

  /**
   * Handle deleted event
   */
  private async handleDeleted(event: RegionEvent) {
    logger.debug({ eventId: event.eventId }, 'Handling deleted event');
    // Implement your logic here
  }
}
