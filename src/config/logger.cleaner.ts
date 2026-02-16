import cron, { ScheduledTask } from 'node-cron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { lt } from 'drizzle-orm';
import { logConfig, createLogger } from '@/config/logger.config';
import { db, httpLogs, activityLogs, errorLogs } from '@/db';

const log = createLogger('LogCleaner');

/* ================= TYPES ================= */

interface TableCleanResult {
  httpLogs: number;
  activityLogs: number;
  errorLogs: number;
}

interface CleanupResult {
  db: { deleted: TableCleanResult; error?: string; };
  file: { deleted: number; error?: string; };
  duration: number;
}

/* ================= CLEANER ================= */

export class LogCleanerService {
  private job: ScheduledTask | null = null;

  /* ---------- START ---------- */

  start(): void {
    const schedule = logConfig.cleanupSchedule;

    if (!cron.validate(schedule)) {
      log.error({ schedule }, 'Invalid cron expression — log cleaner not started');
      return;
    }

    this.job = cron.schedule(schedule, async () => {
      log.info('Starting scheduled log cleanup...');
      const result = await this.cleanup();

      log.info(
        {
          db: result.db.deleted,
          filesDeleted: result.file.deleted,
          duration: `${result.duration}ms`,
        },
        'Log cleanup completed'
      );
    });

    log.info(
      {
        schedule,
        fileRetentionDays: logConfig.fileRetentionDays,
        dbRetentionDays: logConfig.dbRetentionDays,
      },
      'Log cleaner scheduled'
    );
  }

  /* ---------- STOP ---------- */

  async stop(): Promise<void> {
    await this.job?.stop();
    this.job = null;
    log.info('Log cleaner stopped');
  }

  /* ---------- MANUAL TRIGGER ---------- */

  async cleanup(options?: {
    fileRetentionDays?: number;
    dbRetentionDays?: number;
  }): Promise<CleanupResult> {
    const start = Date.now();

    const fileRetention = options?.fileRetentionDays ?? logConfig.fileRetentionDays;
    const dbRetention = options?.dbRetentionDays ?? logConfig.dbRetentionDays;

    const [dbResult, fileResult] = await Promise.allSettled([
      this.cleanDb(dbRetention),
      this.cleanFiles(fileRetention),
    ]);

    return {
      db:
        dbResult.status === 'fulfilled'
          ? dbResult.value
          : { deleted: { httpLogs: 0, activityLogs: 0, errorLogs: 0 }, error: String(dbResult.reason) },
      file:
        fileResult.status === 'fulfilled'
          ? fileResult.value
          : { deleted: 0, error: String(fileResult.reason) },
      duration: Date.now() - start,
    };
  }

  /* ---------- CLEAN DB ---------- */

  private async cleanDb(
    retentionDays: number
  ): Promise<{ deleted: TableCleanResult; error?: string; }> {
    if (!logConfig.toDb) {
      return { deleted: { httpLogs: 0, activityLogs: 0, errorLogs: 0 } };
    }

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);

      const deletedErrors = await db
        .delete(errorLogs)
        .where(lt(errorLogs.createdAt, cutoff))
        .returning({ id: errorLogs.id });

      const deletedActivities = await db
        .delete(activityLogs)
        .where(lt(activityLogs.createdAt, cutoff))
        .returning({ id: activityLogs.id });

      const deletedHttp = await db
        .delete(httpLogs)
        .where(lt(httpLogs.createdAt, cutoff))
        .returning({ id: httpLogs.id });

      const result: TableCleanResult = {
        httpLogs: deletedHttp.length,
        activityLogs: deletedActivities.length,
        errorLogs: deletedErrors.length,
      };

      log.info(
        { ...result, cutoff, retentionDays },
        'DB logs cleaned'
      );

      return { deleted: result };
    } catch (error) {
      log.error({ err: error }, 'Failed to clean DB logs');
      return {
        deleted: { httpLogs: 0, activityLogs: 0, errorLogs: 0 },
        error: String(error),
      };
    }
  }

  /* ---------- CLEAN FILES ---------- */

  private async cleanFiles(
    retentionDays: number
  ): Promise<{ deleted: number; error?: string; }> {
    if (!logConfig.toFile) return { deleted: 0 };

    try {
      const logDir = logConfig.logDir;
      let entries: string[];

      try {
        const dirents = await fs.readdir(logDir, { withFileTypes: true });
        entries = dirents
          .filter((d) => d.isFile() && d.name.endsWith('.log'))
          .map((d) => d.name);
      } catch {
        return { deleted: 0 };
      }

      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      let deleted = 0;

      for (const entry of entries) {
        const filePath = path.join(logDir, entry);

        try {
          const stat = await fs.stat(filePath);

          if (stat.mtimeMs < cutoff) {
            await fs.unlink(filePath);
            deleted++;
            log.debug({ file: filePath }, 'Log file deleted');
          }
        } catch (err) {
          log.warn({ file: filePath, err }, 'Failed to delete log file');
        }
      }

      log.info({ count: deleted, retentionDays, logDir }, 'File logs cleaned');

      return { deleted };
    } catch (error) {
      log.error({ err: error }, 'Failed to clean file logs');
      return { deleted: 0, error: String(error) };
    }
  }
}

/* ================= SINGLETON ================= */

export const logCleaner = new LogCleanerService();