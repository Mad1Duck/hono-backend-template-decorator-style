import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/db/client';
import { userTable } from '@/db/schema';
import { UserService } from '@/services/user.service';
import { UserRepository } from '@/platforms/mobile/repositories/user.repository';
import { logger } from '@/config/logger.config';
import { sql } from 'drizzle-orm';

describe('UserService Integration Tests', () => {
  let service: UserService;
  let repository: UserRepository;

  beforeAll(async () => {
    // Setup service with real dependencies
    repository = new UserRepository();
    service = new UserService();
    (service as any).userRepository = repository;
    (service as any).logger = logger;
  });

  beforeEach(async () => {
    // Clean up database before each test
    await db.delete(userTable);
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(userTable);
  });

  describe('CRUD Operations', () => {
    it('should create and retrieve user', async () => {
      const createData = {
        name: 'Integration Test User',
      };

      // Create
      const created = await service.create(createData);
      
      expect(created.id).toBeDefined();
      expect(created.name).toBe(createData.name);
      expect(created.status).toBe('pending');
      expect(created.createdAt).toBeInstanceOf(Date);

      // Retrieve
      const retrieved = await service.getById(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should update user', async () => {
      // Create initial
      const created = await service.create({ name: 'Original Name' });
      
      // Update
      const updateData = { name: 'Updated Name' };
      const updated = await service.update(created.id, updateData);
      
      expect(updated.name).toBe('Updated Name');
      expect(updated.id).toBe(created.id);
      
      // Verify persistence
      const retrieved = await service.getById(created.id);
      expect(retrieved.name).toBe('Updated Name');
    });

    it('should delete user', async () => {
      // Create
      const created = await service.create({ name: 'To Delete' });
      
      // Delete
      await service.delete(created.id);
      
      // Verify deletion
      await expect(service.getById(created.id)).rejects.toThrow('User not found');
    });

    it('should list users with pagination', async () => {
      // Create multiple items
      const items = await Promise.all([
        service.create({ name: 'User 1' }),
        service.create({ name: 'User 2' }),
        service.create({ name: 'User 3' }),
      ]);

      // Get all
      const result = await service.getAll({ page: 1, limit: 10 });
      
      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should handle pagination correctly', async () => {
      // Create 15 items
      await Promise.all(
        Array.from({ length: 15 }, (_, i) => 
          service.create({ name: `User ${i + 1}` })
        )
      );

      // Get page 1
      const page1 = await service.getAll({ page: 1, limit: 10 });
      expect(page1.data).toHaveLength(10);
      expect(page1.pagination.hasNext).toBe(true);
      expect(page1.pagination.hasPrev).toBe(false);

      // Get page 2
      const page2 = await service.getAll({ page: 2, limit: 10 });
      expect(page2.data).toHaveLength(5);
      expect(page2.pagination.hasNext).toBe(false);
      expect(page2.pagination.hasPrev).toBe(true);
    });

    it('should search users', async () => {
      await Promise.all([
        service.create({ name: 'Apple Product' }),
        service.create({ name: 'Banana Product' }),
        service.create({ name: 'Apple Pie' }),
      ]);

      const result = await service.getAll({ page: 1, limit: 10, search: 'Apple' });
      
      expect(result.data).toHaveLength(2);
      expect(result.data.every(item => item.name.includes('Apple'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent user', async () => {
      await expect(service.getById('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('User not found');
    });

    it('should throw error when updating non-existent user', async () => {
      await expect(service.update('00000000-0000-0000-0000-000000000000', { name: 'Test' }))
        .rejects.toThrow('User not found');
    });

    it('should throw error when deleting non-existent user', async () => {
      await expect(service.delete('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('User not found');
    });
  });
});
