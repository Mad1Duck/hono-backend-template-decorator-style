/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@/core/container';

import * as loggerConfig from '@/config/logger.config';

import type {
  CreateUserDto,
  UpdateUserDto,
  PaginationDto,
} from '@/types/common/user.schema';

import type {
  UserJobData,
} from '@/validation/queue/user.queue.validation';

import { UserRepository } from '@/platforms/web/repositories/user.repository';
/* ================= SERVICE ================= */

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly logger: loggerConfig.Logger
  ) { }

  /* ================= HTTP ================= */

  async getAll(
    query: PaginationDto
  ) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 10;

    const offset =
      (page - 1) * limit;

    const [items, total] =
      await Promise.all([
        this.userRepository.findAll({
          limit,
          offset,
          search: query.search,
        }),

        this.userRepository.count({
          search: query.search,
        }),
      ]);

    return {
      data: items,

      pagination: {
        total,
        page,
        limit,

        totalPages: Math.ceil(
          total / limit
        ),

        hasNext:
          page * limit < total,

        hasPrev: page > 1,
      },
    };
  }

  async getById(id: string) {
    const user =
      await this.userRepository.findById(
        id
      );

    if (!user) {
      throw new Error(
        'User not found'
      );
    }

    return user;
  }

  async create(
    dto: CreateUserDto,
    currentUser?: { id: string; }
  ) {
    this.logger.info(
      {
        dto,
        userId: currentUser?.id,
      },
      'Creating user'
    );

    const user =
      await this.userRepository.create(
        dto
      );

    this.logger.info(
      { userId: user.id },
      'User created'
    );

    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    currentUser?: { id: string; }
  ) {
    await this.getById(id);

    this.logger.info(
      {
        id,
        dto,
        userId: currentUser?.id,
      },
      'Updating user'
    );

    return this.userRepository.update(
      id,
      dto
    );
  }

  async delete(
    id: string,
    currentUser?: { id: string; }
  ) {
    await this.getById(id);

    this.logger.info(
      {
        id,
        userId: currentUser?.id,
      },
      'Deleting user'
    );

    await this.userRepository.delete(id);
  }

  /* ================= QUEUE ================= */

  /**
   * Create user from background job
   */
  async createFromJob(
    data: UserJobData
  ): Promise<void> {
    this.logger.info(
      {
        userId: data.userId,
        source: 'queue',
      },
      'Creating user (job)'
    );

    await this.userRepository.create(
      data.data as CreateUserDto
    );
  }

  /**
   * Update user from background job
   */
  async updateFromJob(
    data: UserJobData
  ): Promise<void> {
    this.logger.info(
      {
        userId: data.userId,
        source: 'queue',
      },
      'Updating user (job)'
    );

    await this.userRepository.update(
      data.userId,
      data.data as UpdateUserDto
    );
  }

  /**
   * Delete user from background job
   */
  async deleteFromJob(
    data: UserJobData
  ): Promise<void> {
    this.logger.info(
      {
        userId: data.userId,
        source: 'queue',
      },
      'Deleting user (job)'
    );

    await this.userRepository.delete(
      data.userId
    );
  }

  /**
   * Sync user (example: external API)
   */
  async syncFromJob(
    data: UserJobData
  ): Promise<void> {
    await this.logger.info(
      {
        userId: data.userId,
      },
      'Syncing user (job)'
    );

    // Example:
    // await this.externalApi.syncUser(data.userId);
  }

  /**
   * Send notification
   */
  async notifyFromJob(
    data: UserJobData
  ): Promise<void> {
    await this.logger.info(
      {
        userId: data.userId,
      },
      'Notifying user (job)'
    );

    // Example:
    // await this.mailer.sendUserMail(...)
  }
}
