# 🎨 Decorators Guide

Complete reference for all decorators available in the Hono Backend Template.

## Table of Contents

- [Route Decorators](#route-decorators)
- [Parameter Decorators](#parameter-decorators)
- [Guard Decorators](#guard-decorators)
- [Validation Decorators](#validation-decorators)
- [Utility Decorators](#utility-decorators)
- [Class Decorators](#class-decorators)
- [Best Practices](#best-practices)

---

## Route Decorators

### `@Controller(basePath, options?)`

Marks a class as a controller and defines the base path for all routes.

**Parameters:**
- `basePath` (string): Base URL path for all routes in this controller
- `options` (optional):
  - `platform`: `'web' | 'mobile' | 'all'` - Platform filter
  - `version`: `'v1' | 'v2' | ...` - API version

**Example:**
```typescript
@Controller('/users', { platform: 'web', version: 'v1' })
@Injectable()
export class UserController {
  // Routes will be prefixed with /api/web/v1/users
}
```

**Complete path structure:**
```
/api/{platform}/{version}{basePath}{routePath}
/api/web/v1/users/123
```

---

### `@Get(path?)`

Defines a GET route handler.

**Parameters:**
- `path` (optional string): Route path relative to controller base path

**Examples:**
```typescript
@Get()           // GET /api/web/v1/users
async getAll() { }

@Get(':id')      // GET /api/web/v1/users/123
async getById(@Param('id') id: string) { }

@Get('active')   // GET /api/web/v1/users/active
async getActive() { }
```

---

### `@Post(path?)`

Defines a POST route handler.

**Example:**
```typescript
@Post()
async create(@Body() dto: CreateUserDto) {
  return await this.userService.create(dto);
}

@Post('bulk')
async createBulk(@Body() dtos: CreateUserDto[]) {
  return await this.userService.createMany(dtos);
}
```

---

### `@Put(path?)`

Defines a PUT route handler for full updates.

**Example:**
```typescript
@Put(':id')
async update(
  @Param('id') id: string,
  @Body() dto: UpdateUserDto
) {
  return await this.userService.update(id, dto);
}
```

---

### `@Patch(path?)`

Defines a PATCH route handler for partial updates.

**Example:**
```typescript
@Patch(':id')
async partialUpdate(
  @Param('id') id: string,
  @Body() dto: Partial<UpdateUserDto>
) {
  return await this.userService.patch(id, dto);
}
```

---

### `@Delete(path?)`

Defines a DELETE route handler.

**Example:**
```typescript
@Delete(':id')
async delete(@Param('id') id: string) {
  await this.userService.delete(id);
  return { message: 'User deleted successfully' };
}
```

---

## Parameter Decorators

### `@Param(name?)`

Extracts URL path parameters.

**Examples:**
```typescript
// Single parameter
@Get(':id')
async getById(@Param('id') id: string) { }

// Multiple parameters
@Get(':userId/posts/:postId')
async getPost(
  @Param('userId') userId: string,
  @Param('postId') postId: string
) { }

// All parameters as object
@Get(':id')
async getById(@Param() params: { id: string }) { }
```

---

### `@Body()`

Extracts request body.

**Example:**
```typescript
@Post()
async create(@Body() dto: CreateUserDto) {
  return await this.userService.create(dto);
}
```

---

### `@Query(name?)`

Extracts query string parameters.

**Examples:**
```typescript
// Single query parameter
@Get()
async search(@Query('q') searchTerm: string) { }

// All query parameters
@Get()
async search(@Query() query: SearchDto) { }

// With pagination
@Get()
async getAll(
  @Query('page') page: number = 1,
  @Query('limit') limit: number = 10
) { }
```

---

### `@Headers(name?)`

Extracts HTTP headers.

**Examples:**
```typescript
// Single header
@Get()
async getAll(@Headers('user-agent') userAgent: string) { }

// All headers
@Get()
async getAll(@Headers() headers: Record<string, string>) { }
```

---

### `@User()`

Extracts authenticated user from context (set by auth middleware).

**Example:**
```typescript
@Post()
@RequireAuth()
async create(
  @Body() dto: CreatePostDto,
  @User() currentUser: UserDto
) {
  return await this.postService.create(dto, currentUser);
}
```

**Note:** Requires authentication middleware to populate context.

---

### `@ValidatedBody(schema)`

Validates request body against Zod schema and extracts typed data.

**Example:**
```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().int().min(18),
});

type CreateUserDto = z.infer<typeof CreateUserSchema>;

@Post()
async create(
  @ValidatedBody(CreateUserSchema) dto: CreateUserDto
) {
  // dto is fully typed and validated!
  return await this.userService.create(dto);
}
```

**Validation errors** return 400:
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "path": ["email"],
        "message": "Invalid email"
      }
    ]
  }
}
```

---

### `@ValidatedQuery(schema)`

Validates query parameters against Zod schema.

**Example:**
```typescript
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

type PaginationDto = z.infer<typeof PaginationSchema>;

@Get()
async getAll(
  @ValidatedQuery(PaginationSchema) query: PaginationDto
) {
  return await this.userService.getAll(query);
}
```

---

### `@ValidatedParam(name, schema)`

Validates single URL parameter.

**Example:**
```typescript
import { z } from 'zod';

@Get(':id')
async getById(
  @ValidatedParam('id', z.string().uuid()) id: string
) {
  return await this.userService.getById(id);
}

@Get(':id/posts/:postId')
async getPost(
  @ValidatedParam('id', z.string().uuid()) userId: string,
  @ValidatedParam('postId', z.string().uuid()) postId: string
) {
  return await this.postService.get(userId, postId);
}
```

---

## Guard Decorators

### `@Public()`

Marks a route as public (skips authentication).

**Example:**
```typescript
@Controller('/users')
@Injectable()
export class UserController {
  @Get()
  @Public()  // Anyone can access
  async getAll() { }

  @Post()
  @RequireAuth()  // Must be authenticated
  async create(@Body() dto: CreateUserDto) { }
}
```

---

### `@RequireAuth()`

Requires user to be authenticated.

**Example:**
```typescript
@Get('/profile')
@RequireAuth()
async getProfile(@User() user: UserDto) {
  return user;
}
```

**Behavior:**
- Checks for valid JWT token
- Extracts user info and sets in context
- Returns 401 if token invalid/missing

**Error Response:**
```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

### `@RequireRole(...roles)`

Requires user to have **at least ONE** of the specified roles.

**Parameters:**
- `...roles` (string[]): List of acceptable roles (OR condition)

**Examples:**
```typescript
// User needs admin OR moderator role
@Delete('/posts/:id')
@RequireRole('admin', 'moderator')
async deletePost(@Param('id') id: string) { }

// Only admins
@Delete('/users/:id')
@RequireRole('admin')
async deleteUser(@Param('id') id: string) { }

// Support staff OR admin
@Post('/support-ticket')
@RequireRole('support', 'admin')
async createTicket(@Body() dto: TicketDto) { }
```

**Error Response (403):**
```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

---

### `@RequireAllRoles(...roles)`

Requires user to have **ALL** specified roles.

**Example:**
```typescript
// User must have BOTH admin AND superuser roles
@Post('/system/settings')
@RequireAllRoles('admin', 'superuser')
async updateSystemSettings(@Body() dto: SettingsDto) { }
```

---

### `@RequirePermission(...permissions)`

Requires user to have **ALL** specified permissions.

**Parameters:**
- `...permissions` (string[]): List of required permissions (AND condition)

**Example:**
```typescript
@Put('/users/:id')
@RequirePermission('users:read', 'users:write')
async updateUser(
  @Param('id') id: string,
  @Body() dto: UpdateUserDto
) { }
```

**Permission format:** `resource:action`
- `users:read`
- `users:write`
- `posts:delete`
- `settings:admin`

---

### `@RequireAnyPermission(...permissions)`

Requires user to have **at least ONE** of the specified permissions.

**Example:**
```typescript
@Get('/content')
@RequireAnyPermission('content:read', 'content:admin')
async getContent() { }
```

---

### `@UseGuards(...guards)`

Apply custom guard classes.

**Example:**
```typescript
class VerifiedEmailGuard {
  async canActivate(context: Context): Promise<boolean> {
    const user = context.get('user');
    return user?.emailVerified === true;
  }
}

@Post('/premium-feature')
@UseGuards(AuthGuard, VerifiedEmailGuard)
async premiumFeature() { }
```

---

## Utility Decorators

### `@RateLimit(options)`

Apply rate limiting to a specific route.

**Parameters:**
- `max` (number): Maximum requests allowed
- `windowMs` (number): Time window in milliseconds
- `keyPrefix?` (string): Custom Redis key prefix
- `message?` (string): Custom error message
- `keyGenerator?` (function): Custom key generator

**Examples:**
```typescript
// Basic: 10 requests per minute
@Post('/login')
@RateLimit({ max: 10, windowMs: 60000 })
async login(@Body() credentials: LoginDto) { }

// Strict: 3 requests per 15 minutes
@Post('/reset-password')
@RateLimit({ 
  max: 3, 
  windowMs: 15 * 60 * 1000,
  message: 'Too many password reset attempts'
})
async resetPassword(@Body() dto: ResetPasswordDto) { }

// Per-user rate limit
@Post('/search')
@RateLimit({
  max: 100,
  windowMs: 3600000,
  keyGenerator: (c) => {
    const user = c.get('user');
    return user?.id || c.req.header('x-forwarded-for') || 'anonymous';
  }
})
async search(@Body() query: SearchDto) { }
```

**Rate limit response (429):**
```json
{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later.",
    "retryAfter": 45,
    "resetTime": "2026-02-16T10:45:00.000Z"
  }
}
```

**Response headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 2026-02-16T10:45:00.000Z
Retry-After: 45
```

---

### `@Cache(options)`

Cache response for specified TTL.

**Parameters:**
- `ttl` (number): Time to live in seconds

**Example:**
```typescript
@Get()
@Cache({ ttl: 300 })  // Cache for 5 minutes
async getAll() {
  return await this.productService.getAll();
}

@Get(':id')
@Cache({ ttl: 3600 })  // Cache for 1 hour
async getById(@Param('id') id: string) {
  return await this.productService.getById(id);
}
```

**Cache invalidation:**
```typescript
@Put(':id')
async update(@Param('id') id: string, @Body() dto: UpdateDto) {
  const result = await this.productService.update(id, dto);
  
  // Invalidate cache
  await this.cacheService.invalidate(`products:${id}`);
  
  return result;
}
```

---

### `@LogActivity(action, options?)`

Log activity to database for audit trails.

**Parameters:**
- `action` (string): Action description
- `options` (optional):
  - `includeBody`: Log request body
  - `includeResult`: Log response

**Examples:**
```typescript
@Post()
@LogActivity('USER_CREATED', { includeBody: true })
async create(@Body() dto: CreateUserDto) { }

@Delete(':id')
@LogActivity('USER_DELETED')
async delete(@Param('id') id: string) { }

@Put(':id')
@LogActivity('USER_UPDATED', { includeBody: true, includeResult: true })
async update(@Param('id') id: string, @Body() dto: UpdateUserDto) { }
```

**Database log entry:**
```typescript
{
  id: "log_123",
  action: "USER_CREATED",
  userId: "user_456",
  controller: "UserController",
  handler: "create",
  statusCode: 201,
  duration: 45,
  before: { name: "John", email: "john@example.com" },
  after: { id: "user_789", name: "John", ... },
  timestamp: "2026-02-16T10:30:00.000Z"
}
```

---

### `@TrackMetrics(options?)`

Track method execution metrics.

**Parameters:**
- `name?` (string): Custom metric name

**Example:**
```typescript
@Post()
@TrackMetrics({ name: 'user_creation' })
async create(@Body() dto: CreateUserDto) { }
```

**Prometheus metrics:**
```
method_duration_seconds{name="user_creation",status="success"} 0.045
method_duration_seconds{name="user_creation",status="error"} 0.023
```

---

### `@Middleware(...middlewares)`

Apply custom middleware to route or class.

**Class-level:**
```typescript
@Controller('/admin')
@Middleware(AuthMiddleware, AdminMiddleware)
export class AdminController {
  // All routes require auth + admin check
}
```

**Method-level:**
```typescript
@Get('/sensitive')
@Middleware(RateLimitMiddleware, AuditMiddleware)
async getSensitiveData() { }
```

---

### `@ApiDoc(options)`

Document API endpoint for OpenAPI/Swagger.

**Parameters:**
- `summary` (string): Short description
- `description` (string): Long description
- `tags?` (string[]): API tags

**Example:**
```typescript
@Get(':id')
@ApiDoc({
  summary: 'Get user by ID',
  description: 'Retrieve detailed user information by user ID',
  tags: ['users']
})
async getById(@Param('id') id: string) { }
```

---

### `@ApiResponse(statusCode, description)`

Document API response.

**Example:**
```typescript
@Post()
@ApiResponse(201, 'User created successfully')
@ApiResponse(400, 'Validation failed')
@ApiResponse(409, 'Email already exists')
async create(@Body() dto: CreateUserDto) { }
```

---

### `@ApiTags(...tags)`

Add tags to all routes in controller.

**Example:**
```typescript
@Controller('/users')
@ApiTags('users', 'authentication')
export class UserController { }
```

---

## Class Decorators

### `@Injectable()`

Marks class for dependency injection.

**Example:**
```typescript
@Injectable()
export class UserService {
  constructor(private db: Database) {}
}
```

---

### `@Singleton()`

Marks service as singleton (created once, shared).

**Example:**
```typescript
@Injectable()
@Singleton()
export class Database {
  private connection: Connection;
  
  constructor() {
    this.connection = createConnection();
  }
}
```

---

## Best Practices

### ✅ DO

```typescript
// 1. Combine decorators logically
@Get(':id')
@RequireAuth()
@Cache({ ttl: 300 })
@ApiDoc({ summary: 'Get user by ID' })
async getById(@ValidatedParam('id', z.string().uuid()) id: string) { }

// 2. Use validation decorators
@Post()
async create(@ValidatedBody(CreateUserSchema) dto: CreateUserDto) { }

// 3. Extract user from context
@Post()
@RequireAuth()
async create(
  @Body() dto: CreatePostDto,
  @User() currentUser: UserDto
) { }

// 4. Apply rate limiting to sensitive endpoints
@Post('/login')
@RateLimit({ max: 5, windowMs: 900000 })
async login(@Body() credentials: LoginDto) { }
```

---

### ❌ DON'T

```typescript
// 1. Don't skip validation
@Post()
async create(@Body() dto: any) { }  // ❌ Use @ValidatedBody

// 2. Don't mix @Public and @RequireAuth
@Get()
@Public()
@RequireAuth()  // ❌ Conflicting decorators
async getAll() { }

// 3. Don't forget rate limiting on expensive operations
@Post('/export')  // ❌ Missing @RateLimit
async exportAllData() { }

// 4. Don't cache authenticated endpoints without consideration
@Get('/profile')
@RequireAuth()
@Cache({ ttl: 3600 })  // ❌ Might cache wrong user's data
async getProfile(@User() user: UserDto) { }
```

---

### Decorator Order

Decorators are executed in **reverse order** (bottom to top):

```typescript
@Get()           // 6. Route registration
@Public()        // 5. Mark as public
@Cache({ ttl: 60 })    // 4. Cache layer
@RateLimit({ max: 100 }) // 3. Rate limiting
@LogActivity('GET_USERS') // 2. Activity logging
@TrackMetrics()  // 1. Metrics (executed first)
async getAll() { }
```

**Recommended order:**
1. HTTP method (@Get, @Post, etc.)
2. Authentication (@Public, @RequireAuth, @RequireRole)
3. Caching (@Cache)
4. Rate limiting (@RateLimit)
5. Logging/Metrics (@LogActivity, @TrackMetrics)
6. Documentation (@ApiDoc, @ApiResponse)

---

### Common Patterns

**Public endpoint with rate limiting:**
```typescript
@Get()
@Public()
@RateLimit({ max: 100, windowMs: 60000 })
async getAll() { }
```

**Protected endpoint with role check:**
```typescript
@Delete(':id')
@RequireAuth()
@RequireRole('admin')
@LogActivity('USER_DELETED')
async delete(@Param('id') id: string) { }
```

**Cached public endpoint:**
```typescript
@Get()
@Public()
@Cache({ ttl: 300 })
@RateLimit({ max: 1000, windowMs: 60000 })
async getAll() { }
```

**Complex validation with multiple checks:**
```typescript
@Post()
@RequireAuth()
@RequirePermission('users:create')
@RateLimit({ max: 10, windowMs: 60000 })
@LogActivity('USER_CREATED', { includeBody: true })
async create(
  @ValidatedBody(CreateUserSchema) dto: CreateUserDto,
  @User() currentUser: UserDto
) { }
```

---

**Next**: [Getting Started Guide](GETTING_STARTED.md) →

**Previous**: [Architecture Guide](ARCHITECTURE.md) ←