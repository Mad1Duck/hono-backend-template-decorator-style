import amqp from 'amqplib';
import { env } from './env.config';

// ── Types ──────────────────────────────────────────────────────────────────
// Use the actual return type from amqplib — avoids the ChannelModel/Connection mismatch
type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

// ── State ──────────────────────────────────────────────────────────────────
let connection: AmqpConnection | null = null;
let channel: AmqpChannel | null = null;
let isConnecting = false;

// ── Connect ────────────────────────────────────────────────────────────────

/**
 * Connect to RabbitMQ.
 * Safe to call multiple times — reuses existing connection/channel.
 */
export async function connectRabbitMQ(): Promise<{
  connection: AmqpConnection;
  channel: AmqpChannel;
}> {
  // Already connected
  if (connection && channel) {
    return { connection, channel };
  }

  // Prevent concurrent connect calls racing each other
  if (isConnecting) {
    await new Promise<void>(resolve => setTimeout(resolve, 100));
    return connectRabbitMQ();
  }

  isConnecting = true;

  try {
    connection = await amqp.connect(env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Prefetch — process one message at a time per consumer
    await channel.prefetch(1);

    console.log('RabbitMQ connected');

    // Handle connection-level errors
    connection.on('error', (err: Error) => {
      console.error('RabbitMQ connection error:', err.message);
      connection = null;
      channel = null;
    });

    connection.on('close', () => {
      console.warn('RabbitMQ connection closed');
      connection = null;
      channel = null;
    });

    return { connection, channel };
  } finally {
    isConnecting = false;
  }
}

// ── Get channel ────────────────────────────────────────────────────────────

/**
 * Get the active channel.
 * Throws if connectRabbitMQ() has not been called yet.
 */
export function getChannel(): AmqpChannel {
  if (!channel) {
    throw new Error(
      'RabbitMQ not connected. Call connectRabbitMQ() before using getChannel().'
    );
  }
  return channel;
}

/**
 * Get the active connection.
 * Throws if connectRabbitMQ() has not been called yet.
 */
export function getConnection(): AmqpConnection {
  if (!connection) {
    throw new Error(
      'RabbitMQ not connected. Call connectRabbitMQ() before using getConnection().'
    );
  }
  return connection;
}

// ── Close ──────────────────────────────────────────────────────────────────

/**
 * Gracefully close the RabbitMQ channel and connection.
 */
export async function closeRabbitMQ(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    console.log('RabbitMQ connection closed');
  } catch (err) {
    console.error('Error closing RabbitMQ:', err);
  }
}

// ── Health check ───────────────────────────────────────────────────────────

/**
 * Returns true if connection and channel are both active.
 */
export function isRabbitMQConnected(): boolean {
  return connection !== null && channel !== null;
}
