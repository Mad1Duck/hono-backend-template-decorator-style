import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// TODO: Add your tables here

// Example:
export const userTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
