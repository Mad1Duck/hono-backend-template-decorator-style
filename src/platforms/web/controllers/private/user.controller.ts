/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { z } from 'zod';

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  User,
  RequireAuth,
  RequireRole,
  Public,
  RateLimit,
  Cache,
  LogActivity,
  TrackMetrics,
  ApiDoc,
  ApiResponse,
  ApiTags,
  ValidatedBody,
  ValidatedQuery,
  ValidatedParam,
} from '@/decorators';

import { UserService } from '@/services/user.service';

import {
  CreateUserSchema,
  UpdateUserSchema,
  PaginationSchema,
  type CreateUserDto,
  type UpdateUserDto,
  type PaginationDto,
} from '@/types/common/user.schema';

import { Injectable } from '@/core/container';
import * as loggerConfig from '@/config/logger.config';

/* ================= AUTH TYPE ================= */

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

/* ================= CONTROLLER ================= */

@Controller('/users', {
  platform: 'web',
  version: 'v1',
})
@ApiTags('users')
@Injectable()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: loggerConfig.Logger
  ) { }

  /* ================= GET ALL ================= */

  @Get()
  @Public()
  @Cache({ ttl: 60 })
  @TrackMetrics()
  @ApiDoc({
    summary: 'Get all users',
    description: 'Retrieve paginated list of users',
  })
  @ApiResponse(200, 'Users retrieved successfully')
  async getAll(
    @ValidatedQuery(PaginationSchema)
    query: PaginationDto
  ) {
    return this.userService.getAll(query);
  }

  /* ================= GET BY ID ================= */

  @Get(':id')
  @RequireAuth()
  @Cache({ ttl: 300 })
  @ApiDoc({
    summary: 'Get user by ID',
  })
  @ApiResponse(200, 'User found')
  @ApiResponse(404, 'User not found')
  async getById(
    @ValidatedParam('id', z.string().uuid())
    id: string
  ) {
    return this.userService.getById(id);
  }

  /* ================= CREATE ================= */

  @Post()
  @RequireAuth()
  @RateLimit({
    max: 10,
    windowMs: 60_000,
  })
  @LogActivity('USER_CREATED', {
    includeBody: true,
  })
  @TrackMetrics({
    name: 'user_creation',
  })
  @ApiDoc({
    summary: 'Create new user',
  })
  @ApiResponse(201, 'User created')
  @ApiResponse(400, 'Validation failed')
  async create(
    @ValidatedBody(CreateUserSchema)
    dto: CreateUserDto,

    @User()
    currentUser: AuthUser
  ) {
    this.logger.info(
      {
        userId: currentUser.id,
        action: 'create_user',
      },
      'Creating user'
    );

    return this.userService.create(dto, currentUser);
  }

  /* ================= UPDATE ================= */

  @Put(':id')
  @RequireAuth()
  @LogActivity('USER_UPDATED')
  @TrackMetrics()
  @ApiDoc({
    summary: 'Update user',
  })
  @ApiResponse(200, 'User updated')
  @ApiResponse(400, 'Validation failed')
  async update(
    @ValidatedParam('id', z.string().uuid())
    id: string,

    @ValidatedBody(UpdateUserSchema)
    dto: UpdateUserDto,

    @User()
    currentUser: AuthUser
  ) {
    this.logger.info(
      {
        userId: currentUser.id,
        targetUserId: id,
        action: 'update_user',
      },
      'Updating user'
    );

    return this.userService.update(id, dto, currentUser);
  }

  /* ================= DELETE ================= */

  @Delete(':id')
  @RequireRole('admin')
  @LogActivity('USER_DELETED')
  @TrackMetrics()
  @ApiDoc({
    summary: 'Delete user',
  })
  @ApiResponse(200, 'User deleted')
  @ApiResponse(403, 'Forbidden')
  async delete(
    @ValidatedParam('id', z.string().uuid())
    id: string,

    @User()
    currentUser: AuthUser
  ) {
    this.logger.warn(
      {
        adminId: currentUser.id,
        deletedUserId: id,
        action: 'delete_user',
      },
      'Deleting user'
    );

    await this.userService.delete(id, currentUser);

    return {
      message: 'User deleted successfully',
    };
  }
}
