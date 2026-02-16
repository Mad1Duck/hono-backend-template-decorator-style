import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const logLevelEnum = pgEnum('log_level', [
  'FATAL',
  'ERROR',
  'WARN',
  'INFO',
  'DEBUG',
  'TRACE',
]);

export const httpMethodEnum = pgEnum('http_method', [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

export const httpLogs = pgTable(
  'http_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestId: varchar('request_id', { length: 36 }),
    method: httpMethodEnum('method').notNull(),
    url: text('url').notNull(),
    path: text('path').notNull(),
    userAgent: text('user_agent'),
    host: varchar('host', { length: 255 }),
    remoteAddress: varchar('remote_address', { length: 45 }),
    referer: text('referer'),
    statusCode: integer('status_code').notNull(),
    duration: integer('duration').notNull(),
    userId: uuid('user_id'),
    action: varchar('action', { length: 100 }),
    controller: varchar('controller', { length: 100 }),
    handler: varchar('handler', { length: 100 }),
    level: logLevelEnum('level').notNull().default('INFO'),
    message: text('message').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('http_logs_created_at_idx').on(t.createdAt),
    index('http_logs_status_code_idx').on(t.statusCode),
    index('http_logs_user_id_idx').on(t.userId),
    index('http_logs_method_idx').on(t.method),
    index('http_logs_action_idx').on(t.action),
    index('http_logs_level_idx').on(t.level),
    index('http_logs_user_created_idx').on(t.userId, t.createdAt),
  ]
);

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    httpLogId: uuid('http_log_id').references(() => httpLogs.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id'),
    userRole: varchar('user_role', { length: 50 }),
    userEmail: varchar('user_email', { length: 255 }),
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 100 }),
    resourceId: varchar('resource_id', { length: 36 }),
    before: jsonb('before'),
    after: jsonb('after'),
    metadata: jsonb('metadata'),
    success: boolean('success').notNull().default(true),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('activity_logs_created_at_idx').on(t.createdAt),
    index('activity_logs_user_id_idx').on(t.userId),
    index('activity_logs_action_idx').on(t.action),
    index('activity_logs_resource_idx').on(t.resource, t.resourceId),
    index('activity_logs_success_idx').on(t.success),
    index('activity_logs_user_action_idx').on(t.userId, t.action, t.createdAt),
  ]
);

export const errorLogs = pgTable(
  'error_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    httpLogId: uuid('http_log_id').references(() => httpLogs.id, {
      onDelete: 'set null',
    }),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message').notNull(),
    errorStack: text('error_stack'),
    errorName: varchar('error_name', { length: 100 }),
    controller: varchar('controller', { length: 100 }),
    handler: varchar('handler', { length: 100 }),
    userId: uuid('user_id'),
    requestId: varchar('request_id', { length: 36 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('error_logs_created_at_idx').on(t.createdAt),
    index('error_logs_error_code_idx').on(t.errorCode),
    index('error_logs_user_id_idx').on(t.userId),
    index('error_logs_error_name_idx').on(t.errorName),
  ]
);

/* ================= TYPES ================= */
export type HttpLog = typeof httpLogs.$inferSelect;
export type InsertHttpLog = typeof httpLogs.$inferInsert;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;