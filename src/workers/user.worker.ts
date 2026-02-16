import { Worker, Job } from 'bullmq';

import { queueRedisConnection } from '@/config/queue.config';
import { logger } from '@/config/logger.config';

import {
  queueJobsProcessed,
  queueJobDuration,
} from '@/config/metrics.config';

import { UserService } from '@/services/user.service';

import {
  validateUserJobData,
  type UserJobData,
  type UserJobResult,
} from '@/validation/queue/user.queue.validation';
import { UserRepository } from '@/platforms/web/repositories/user.repository';

/* ================= TYPES ================= */

type JobAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'sync'
  | 'notify';

/* ================= WORKER ================= */

export class UserWorker {
  private readonly worker: Worker<
    UserJobData,
    UserJobResult
  >;

  private readonly userService: UserService;

  constructor(userService?: UserService) {
    // Allow DI (for testing)
    this.userService =
      userService ?? new UserService(UserRepository, logger);

    this.worker = new Worker<
      UserJobData,
      UserJobResult
    >(
      'user-queue',
      (job) => this.processJob(job),
      {
        connection: queueRedisConnection,

        concurrency: 5,

        limiter: {
          max: 10,
          duration: 1_000,
        },
      }
    );

    this.setupEventHandlers();
  }

  /* ================= PROCESS ================= */

  private async processJob(
    job: Job<UserJobData>
  ): Promise<UserJobResult> {
    const start = Date.now();

    logger.info(
      {
        jobId: job.id,
        action: job.data.action,
      },
      'Processing user job'
    );

    try {
      /* ---------- VALIDATE ---------- */

      const validated =
        validateUserJobData(job.data);

      /* ---------- EXECUTE ---------- */

      await this.executeAction(validated);

      /* ---------- METRICS ---------- */

      const duration =
        Date.now() - start;

      queueJobsProcessed.inc({
        queue: 'user-queue',
        status: 'success',
      });

      queueJobDuration.observe(
        {
          queue: 'user-queue',
          job_type: validated.action,
        },
        duration / 1000
      );

      logger.info(
        {
          jobId: job.id,
          duration,
        },
        'User job completed'
      );

      /* ---------- RESULT ---------- */

      return {
        success: true,
        userId: validated.userId,
        action: validated.action,
        processedAt: Date.now(),
        duration,
      };
    } catch (error: unknown) {
      const duration =
        Date.now() - start;

      queueJobsProcessed.inc({
        queue: 'user-queue',
        status: 'error',
      });

      logger.error(
        {
          jobId: job.id,
          error,
          duration,
        },
        'User job failed'
      );

      throw error;
    }
  }

  /* ================= ACTION ROUTER ================= */

  private async executeAction(
    data: UserJobData
  ): Promise<void> {
    switch (data.action as JobAction) {
      case 'create':
        await this.handleCreate(data);
        break;

      case 'update':
        await this.handleUpdate(data);
        break;

      case 'delete':
        await this.handleDelete(data);
        break;

      case 'sync':
        await this.handleSync(data);
        break;

      case 'notify':
        await this.handleNotify(data);
        break;

      default:
        this.assertNever("");
    }
  }

  /* ================= HANDLERS ================= */

  private async handleCreate(
    data: UserJobData
  ): Promise<void> {
    logger.debug(
      { userId: data.userId },
      'Handling create'
    );

    await this.userService.createFromJob(
      data
    );
  }

  private async handleUpdate(
    data: UserJobData
  ): Promise<void> {
    logger.debug(
      { userId: data.userId },
      'Handling update'
    );

    await this.userService.updateFromJob(
      data
    );
  }

  private async handleDelete(
    data: UserJobData
  ): Promise<void> {
    logger.debug(
      { userId: data.userId },
      'Handling delete'
    );

    await this.userService.deleteFromJob(
      data
    );
  }

  private async handleSync(
    data: UserJobData
  ): Promise<void> {
    logger.debug(
      { userId: data.userId },
      'Handling sync'
    );

    await this.userService.syncFromJob(
      data
    );
  }

  private async handleNotify(
    data: UserJobData
  ): Promise<void> {
    logger.debug(
      { userId: data.userId },
      'Handling notify'
    );

    await this.userService.notifyFromJob(
      data
    );
  }

  /* ================= EVENTS ================= */

  private setupEventHandlers(): void {
    this.worker.on(
      'completed',
      (job) => {
        logger.debug(
          { jobId: job.id },
          'Job completed'
        );
      }
    );

    this.worker.on(
      'failed',
      (job, err) => {
        logger.error(
          {
            jobId: job?.id,
            error: err,
          },
          'Job failed'
        );
      }
    );

    this.worker.on(
      'error',
      (err) => {
        logger.error(
          { error: err },
          'Worker error'
        );
      }
    );
  }

  /* ================= SHUTDOWN ================= */

  async close(): Promise<void> {
    await this.worker.close();

    logger.info('User worker closed');
  }

  /* ================= UTIL ================= */

  private assertNever(
    value: string
  ): never {
    throw new Error(
      `Unhandled action: ${String(value)}`
    );
  }
}
