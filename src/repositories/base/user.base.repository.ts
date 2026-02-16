import { userTable } from '@/db/schema/user.schema';
import { eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { UserEntity } from '@/platforms/web/repositories/user.repository';
import { UserInsert } from '@/types/entities/user.entities';

/**
 * Base User Repository
 * Contains shared CRUD operations for all platforms
 */
export abstract class UserBaseRepository {
  /**
   * Find by ID
   */
  async findById(id: string): Promise<UserEntity | null> {
    const result = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create new record
   */
  async create(data: Omit<UserInsert, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserEntity | null> {
    const result = await db
      .insert(userTable)
      .values(data)
      .returning();

    return result[0] || null;
  }

  /**
   * Update record
   */
  async update(id: string, data: Partial<UserInsert>): Promise<UserEntity | null> {
    const result = await db
      .update(userTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userTable.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * Delete record
   */
  async delete(id: string): Promise<void> {
    await db
      .delete(userTable)
      .where(eq(userTable.id, id));
  }

  /**
   * Count records
   */
  async count(options?: { search?: string; }): Promise<number> {
    const conditions = this.buildSearchConditions(options?.search);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(userTable)
      .where(conditions);

    return Number(result?.[0]?.count);
  }

  /**
   * Platform-specific findAll - must be implemented by child classes
   */
  abstract findAll(options: {
    limit: number;
    offset: number;
    search?: string;
  }): Promise<UserEntity[]>;

  /**
   * Build search conditions
   */
  protected buildSearchConditions(search?: string) {
    if (!search) return undefined;

    return or(
      ilike(userTable.name, `%${search}%`),
    );
  }
}
