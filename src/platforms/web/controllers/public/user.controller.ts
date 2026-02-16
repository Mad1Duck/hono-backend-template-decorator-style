import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  User,
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
  Middleware,
} from '@/decorators';
import {
  AuthMiddleware,
  RequireRole,
} from '@/middleware/auth.middleware';
import { UserService } from '@/platforms/web/services/user.service';
import {
  CreateUserSchema,
  UpdateUserSchema,
  PaginationSchema,
  type CreateUserDto,
  type UpdateUserDto,
  type PaginationDto,
} from '@/types/common/user.schema';
import { z } from 'zod';
import { Injectable } from '@/core/container';

@Controller('/users', { platform: 'web', version: 'v1' })
@ApiTags('users')
@Injectable()
export class UserController {
  constructor(
    private userService: UserService,
  ) { }

  @Get()
  @Public()
  @Cache({ ttl: 60 })
  @RateLimit({ max: 5, windowMs: 1 * 60 * 1000 })
  @TrackMetrics()
  @LogActivity('_GET', { includeResult: false })
  @ApiDoc({
    summary: 'Get all users',
    description: 'Retrieve paginated list of users',
  })
  @ApiResponse(200, 'Users retrieved successfully')
  async getAll(
    @ValidatedQuery(PaginationSchema) query: PaginationDto
  ) {
    return await this.userService.getAll(query);
  }

  @Get(':id')
  @Middleware(AuthMiddleware)
  @Cache({ ttl: 300 })
  @ApiDoc({ summary: 'Get user by ID' })
  @ApiResponse(200, 'User found')
  @ApiResponse(404, 'User not found')
  async getById(
    @ValidatedParam('id', z.string().uuid()) id: string
  ) {
    return await this.userService.getById(id);
  }

  @Post()
  @Middleware(AuthMiddleware)
  @RateLimit({ max: 10, windowMs: 60000 })
  @LogActivity('_CREATED', { includeBody: true })
  @TrackMetrics({ name: 'user_creation' })
  @ApiDoc({ summary: 'Create new user' })
  @ApiResponse(201, 'User created')
  @ApiResponse(400, 'Validation failed')
  async create(
    @ValidatedBody(CreateUserSchema) dto: CreateUserDto,
    @User() currentUser: any
  ) {
    return await this.userService.create(dto, currentUser);
  }

  @Put(':id')
  @Middleware(AuthMiddleware)
  @LogActivity('_UPDATED')
  @TrackMetrics()
  @ApiDoc({ summary: 'Update user' })
  async update(
    @ValidatedParam('id', z.string().uuid()) id: string,
    @ValidatedBody(UpdateUserSchema) dto: UpdateUserDto,
    @User() currentUser: any
  ) {
    return await this.userService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Middleware(AuthMiddleware, RequireRole('admin'))
  @LogActivity('_DELETED')
  @TrackMetrics()
  @ApiDoc({ summary: 'Delete user' })
  @ApiResponse(200, 'User deleted')
  @ApiResponse(403, 'Forbidden')
  async delete(
    @ValidatedParam('id', z.string().uuid()) id: string,
    @User() currentUser: any
  ) {
    await this.userService.delete(id, currentUser);
    return { message: 'User deleted successfully' };
  }
}