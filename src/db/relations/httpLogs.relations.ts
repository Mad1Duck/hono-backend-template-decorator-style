import { relations } from 'drizzle-orm';
import {
  httpLogs,
  activityLogs,
  errorLogs,
} from '../schema/default/httpLogs.schema';

/* ================= HTTP LOGS RELATIONS ================= */

export const httpLogsRelations = relations(httpLogs, ({ many }) => ({
  activities: many(activityLogs),
  errors: many(errorLogs),
}));

/* ================= ACTIVITY LOGS RELATIONS ================= */

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  httpLog: one(httpLogs, {
    fields: [activityLogs.httpLogId],
    references: [httpLogs.id],
  }),
}));

/* ================= ERROR LOGS RELATIONS ================= */

export const errorLogsRelations = relations(errorLogs, ({ one }) => ({
  httpLog: one(httpLogs, {
    fields: [errorLogs.httpLogId],
    references: [httpLogs.id],
  }),
}));