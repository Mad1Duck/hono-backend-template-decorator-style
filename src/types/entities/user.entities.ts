import { userTable } from "@/db";

/* ================= TYPES ================= */
export type UserUserEntity = typeof userTable.$inferSelect;
export type UserInsert = typeof userTable.$inferInsert;