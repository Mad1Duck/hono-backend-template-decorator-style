import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserService } from '@/services/user.service';
import { UserRepository } from '@/platforms/mobile/repositories/user.repository';
import { Logger } from '@/config/logger.config';

// Mock dependencies
vi.mock('@/platforms/mobile/repositories/user.repository');
vi.mock('@/config/logger.config');

describe('UserService', () => {
  let service: UserService;
  let mockRepository: vi.Mocked<UserRepository>;
  let mockLogger: vi.Mocked<Logger>;

  beforeEach(() => {
    // Create mock instances
    mockRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any;

    // Create service with mocks
    service = new UserService();
    (service as any).userRepository = mockRepository;
    (service as any).logger = mockLogger;

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test User',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw error when user not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getById('non-existent-id')).rejects.toThrow('User not found');
      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('getAll', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test User 1',
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '223e4567-e89b-12d3-a456-426614174001',
          name: 'Test User 2',
          status: 'inactive' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.findAll.mockResolvedValue(mockUsers);
      mockRepository.count.mockResolvedValue(2);

      const result = await service.getAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockUsers);
      expect(result.pagination).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        search: undefined,
      });
    });

    it('should handle pagination correctly', async () => {
      mockRepository.findAll.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(25);

      const result = await service.getAll({ page: 2, limit: 10 });

      expect(result.pagination).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 10,
        search: undefined,
      });
    });
  });

  describe('create', () => {
    it('should create new user', async () => {
      const createDto = {
        name: 'New User',
      };

      const createdUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...createDto,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockResolvedValue(createdUser);

      const result = await service.create(createDto);

      expect(result).toEqual(createdUser);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ dto: createDto }),
        'Creating user'
      );
    });
  });

  describe('update', () => {
    it('should update existing user', async () => {
      const existingUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Old Name',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto = {
        name: 'New Name',
      };

      const updatedUser = {
        ...existingUser,
        ...updateDto,
      };

      mockRepository.findById.mockResolvedValue(existingUser);
      mockRepository.update.mockResolvedValue(updatedUser);

      const result = await service.update('123e4567-e89b-12d3-a456-426614174000', updateDto);

      expect(result).toEqual(updatedUser);
      expect(mockRepository.update).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', updateDto);
    });

    it('should throw error when user not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { name: 'New Name' }))
        .rejects.toThrow('User not found');
    });
  });

  describe('delete', () => {
    it('should delete existing user', async () => {
      const existingUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test User',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(existingUser);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete('123e4567-e89b-12d3-a456-426614174000');

      expect(mockRepository.delete).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.delete('non-existent-id')).rejects.toThrow('User not found');
    });
  });
});
