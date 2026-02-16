# 🚀 Getting Started Guide

Step-by-step tutorial to get you up and running with the Hono Backend Template.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Your First Endpoint](#your-first-endpoint)
- [Adding Authentication](#adding-authentication)
- [Database Integration](#database-integration)
- [Testing Your API](#testing-your-api)
- [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required

- **[Bun](https://bun.sh/)** >= 1.0
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **[Redis](https://redis.io/)** >= 6.0
  ```bash
  # macOS
  brew install redis
  brew services start redis
  
  # Ubuntu/Debian
  sudo apt install redis-server
  sudo systemctl start redis
  
  # Docker
  docker run -d -p 6379:6379 redis:7-alpine
  ```

- **[PostgreSQL](https://www.postgresql.org/)** >= 14.0
  ```bash
  # macOS
  brew install postgresql@14
  brew services start postgresql@14
  
  # Ubuntu/Debian
  sudo apt install postgresql-14
  
  # Docker
  docker run -d -p 5432:5432 \
    -e POSTGRES_PASSWORD=password \
    postgres:14-alpine
  ```

### Recommended

- **[Visual Studio Code](https://code.visualstudio.com/)** with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Mad1Duck/hono-backend-template-decorator-style.git
cd hono-backend-template-decorator-style
```

### 2. Install Dependencies

```bash
bun install
```

This will install all required packages including:
- `hono` - Web framework
- `drizzle-orm` - Database ORM
- `zod` - Validation
- `pino` - Logging
- `ioredis` - Redis client

### 3. Setup Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

**Minimal `.env` configuration:**
```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/hono_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (generate a strong secret!)
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_TO_DB=true
```

### 4. Setup Database

```bash
# Create database (if not exists)
createdb hono_db

# Generate migrations
bun run db:generate

# Run migrations
bun run db:migrate
```

### 5. Start Development Server

```bash
bun run dev
```

You should see:
```
🚀 Server started successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Environment: development
🔌 Port: 3000

📍 Endpoints:
   💻 Web API:    http://localhost:3000/api/web/v1
   📱 Mobile API: http://localhost:3000/api/mobile/v1
   📊 Metrics:    http://localhost:3000/metrics
   ❤️  Health:    http://localhost:3000/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 6. Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-02-16T10:30:00.000Z",
  "uptime": 1.234,
  "memory": { ... },
  "environment": "development"
}
```

---

## Project Structure

```
hono-backend-template-decorator-style/
├── src/
│   ├── config/              # Configuration files
│   │   ├── env.config.ts    # Environment variables
│   │   ├── cache.config.ts  # Redis setup
│   │   └── logger.config.ts # Pino logger
│   │
│   ├── core/                # Core framework
│   │   ├── container.ts     # DI container
│   │   ├── route-builder.ts # Route registration
│   │   └── types.ts         # Type definitions
│   │
│   ├── decorators/          # Decorators
│   │   ├── route.ts         # @Get, @Post, etc.
│   │   ├── guard.ts         # @RequireAuth, etc.
│   │   └── param.ts         # @Body, @Query, etc.
│   │
│   ├── middleware/          # Middleware
│   │   ├── auth.middleware.ts
│   │   ├── logger.middleware.ts
│   │   └── rateLimit.middleware.ts
│   │
│   ├── platforms/           # Platform routes
│   │   ├── web/
│   │   │   ├── controllers/ # Controllers
│   │   │   └── routes/      # Route registration
│   │   └── mobile/
│   │       └── routes/
│   │
│   ├── services/            # Business logic
│   │   └── user.service.ts
│   │
│   ├── db/                  # Database
│   │   ├── schema/          # Drizzle schemas
│   │   └── index.ts         # DB connection
│   │
│   └── server.ts            # App entry point
│
├── tests/                   # Test files
├── logs/                    # Log files
└── docs/                    # Documentation
```

---

## Your First Endpoint

Let's create a simple "Hello World" endpoint!

### Step 1: Create a Controller

Create `src/platforms/web/controllers/hello.controller.ts`:

```typescript
import { Controller, Get, Injectable } from '@/decorators';

@Controller('/hello', { platform: 'web', version: 'v1' })
@Injectable()
export class HelloController {
  @Get()
  async sayHello() {
    return {
      message: 'Hello, World!',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':name')
  async sayHelloTo(@Param('name') name: string) {
    return {
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Step 2: Register the Controller

Edit `src/platforms/web/routes/index.ts`:

```typescript
import { Hono } from 'hono';
import { HonoRouteBuilder } from '@/core/route-builder';

// Import your controller
import { HelloController } from '../controllers/hello.controller';
import { UserController } from '../controllers/user.controller';

const app = new Hono();

// Register routes
app.route('/', HonoRouteBuilder.build(HelloController, 'web'));
app.route('/', HonoRouteBuilder.build(UserController, 'web'));

export default app;
```

### Step 3: Test It!

```bash
# Restart the server (or it auto-reloads in dev mode)
bun run dev

# Test the endpoint
curl http://localhost:3000/api/web/v1/hello

# Response:
{
  "message": "Hello, World!",
  "timestamp": "2026-02-16T10:30:00.000Z"
}

# Test with parameter
curl http://localhost:3000/api/web/v1/hello/John

# Response:
{
  "message": "Hello, John!",
  "timestamp": "2026-02-16T10:30:00.000Z"
}
```

---

## Adding Authentication

Now let's add authentication to protect some endpoints.

### Step 1: Create User Schema

Create `src/types/schemas/user.schema.ts`:

```typescript
import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
```

### Step 2: Create Auth Service

Create `src/services/auth.service.ts`:

```typescript
import { Injectable, Singleton } from '@/core/container';
import { sign, verify } from 'jsonwebtoken';
import { env } from '@/config/env.config';
import type { LoginDto } from '@/types/schemas/user.schema';

@Injectable()
@Singleton()
export class AuthService {
  async login(dto: LoginDto) {
    // TODO: Verify credentials against database
    const user = await this.validateCredentials(dto);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = sign(
      { 
        userId: user.id, 
        email: user.email,
        roles: user.roles 
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async verifyToken(token: string) {
    try {
      const payload = verify(token, env.JWT_SECRET);
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private async validateCredentials(dto: LoginDto) {
    // TODO: Implement actual validation
    // This is just an example
    return {
      id: 'user-123',
      name: 'John Doe',
      email: dto.email,
      roles: ['user'],
    };
  }
}
```

### Step 3: Create Auth Controller

Create `src/platforms/web/controllers/auth.controller.ts`:

```typescript
import { 
  Controller, 
  Post, 
  Injectable,
  ValidatedBody,
  RateLimit,
  Public 
} from '@/decorators';
import { AuthService } from '@/services/auth.service';
import { LoginSchema, type LoginDto } from '@/types/schemas/user.schema';

@Controller('/auth', { platform: 'web', version: 'v1' })
@Injectable()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/login')
  @Public()
  @RateLimit({ max: 5, windowMs: 15 * 60 * 1000 })  // 5 attempts per 15 minutes
  async login(@ValidatedBody(LoginSchema) dto: LoginDto) {
    return await this.authService.login(dto);
  }
}
```

### Step 4: Protected Endpoint

Update `src/platforms/web/controllers/hello.controller.ts`:

```typescript
import { 
  Controller, 
  Get, 
  Injectable,
  RequireAuth,
  User,
  Param 
} from '@/decorators';

@Controller('/hello', { platform: 'web', version: 'v1' })
@Injectable()
export class HelloController {
  @Get()
  @Public()
  async sayHello() {
    return {
      message: 'Hello, World!',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('/protected')
  @RequireAuth()
  async protectedHello(@User() user: any) {
    return {
      message: `Hello, ${user.name}! This is a protected endpoint.`,
      userId: user.userId,
    };
  }
}
```

### Step 5: Test Authentication

```bash
# 1. Login to get token
curl -X POST http://localhost:3000/api/web/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "name": "John Doe",
    "email": "test@example.com"
  }
}

# 2. Access protected endpoint (should fail without token)
curl http://localhost:3000/api/web/v1/hello/protected

# Response: 401 Unauthorized
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}

# 3. Access with token
curl http://localhost:3000/api/web/v1/hello/protected \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Response: 200 OK
{
  "message": "Hello, John Doe! This is a protected endpoint.",
  "userId": "user-123"
}
```

---

## Database Integration

Let's add database support with Drizzle ORM.

### Step 1: Define Schema

Create `src/db/schema/users.schema.ts`:

```typescript
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

### Step 2: Create User Service

Create `src/services/user.service.ts`:

```typescript
import { Injectable } from '@/core/container';
import { db } from '@/db';
import { users, type NewUser } from '@/db/schema/users.schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  async create(data: { name: string; email: string; password: string }) {
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Insert user
    const [user] = await db.insert(users).values({
      name: data.name,
      email: data.email,
      passwordHash,
    }).returning();

    // Don't return password hash
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async getById(id: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async getAll() {
    const allUsers = await db.select().from(users);
    
    return allUsers.map(({ passwordHash: _, ...user }) => user);
  }

  async findByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }

  async verifyPassword(email: string, password: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      return false;
    }

    return bcrypt.compare(password, user.passwordHash);
  }
}
```

### Step 3: Generate & Run Migration

```bash
# Generate migration from schema
bun run db:generate

# Review the generated migration in src/db/migrations/

# Run migration
bun run db:migrate

# Verify in database
psql -d hono_db -c "SELECT * FROM users;"
```

### Step 4: Update Auth Service

Update `src/services/auth.service.ts`:

```typescript
import { Injectable, Singleton } from '@/core/container';
import { UserService } from './user.service';
import { sign } from 'jsonwebtoken';
import { env } from '@/config/env.config';

@Injectable()
@Singleton()
export class AuthService {
  constructor(private userService: UserService) {}

  async login(dto: { email: string; password: string }) {
    // Verify password
    const isValid = await this.userService.verifyPassword(
      dto.email,
      dto.password
    );

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Get user
    const user = await this.userService.findByEmail(dto.email);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate token
    const token = sign(
      { 
        userId: user.id, 
        email: user.email,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }
}
```

### Step 5: Create User Endpoint

Create `src/platforms/web/controllers/user.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Injectable,
  ValidatedBody,
  Param,
  RequireAuth,
  Public,
  RateLimit,
  Cache,
} from '@/decorators';
import { UserService } from '@/services/user.service';
import { CreateUserSchema, type CreateUserDto } from '@/types/schemas/user.schema';

@Controller('/users', { platform: 'web', version: 'v1' })
@Injectable()
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  @Public()
  @Cache({ ttl: 60 })
  @RateLimit({ max: 100, windowMs: 60000 })
  async getAll() {
    return await this.userService.getAll();
  }

  @Get(':id')
  @RequireAuth()
  async getById(@Param('id') id: string) {
    return await this.userService.getById(id);
  }

  @Post()
  @Public()
  @RateLimit({ max: 3, windowMs: 3600000 })  // 3 signups per hour
  async create(@ValidatedBody(CreateUserSchema) dto: CreateUserDto) {
    return await this.userService.create(dto);
  }
}
```

---

## Testing Your API

### Manual Testing with cURL

```bash
# 1. Create a user
curl -X POST http://localhost:3000/api/web/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepass123"
  }'

# 2. Login
curl -X POST http://localhost:3000/api/web/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepass123"
  }'

# Save the token from response

# 3. Get all users (public, cached)
curl http://localhost:3000/api/web/v1/users

# 4. Get specific user (requires auth)
curl http://localhost:3000/api/web/v1/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Testing with Postman

1. **Import Collection** - Create a new collection
2. **Set Variables**:
   - `baseUrl`: `http://localhost:3000`
   - `token`: (will be set after login)
3. **Create Requests**:
   - POST `/api/web/v1/users` - Create user
   - POST `/api/web/v1/auth/login` - Login
   - GET `/api/web/v1/users` - Get all users
   - GET `/api/web/v1/users/:id` - Get user by ID

### Rate Limit Testing

```bash
# Test rate limit (5 requests in 1 minute)
for i in {1..7}; do
  echo "Request $i"
  curl http://localhost:3000/api/web/v1/users
  echo "\n---"
done

# Request 1-5: Success
# Request 6-7: 429 Rate Limit Exceeded
```

---

## Next Steps

### 🎯 What You've Learned

✅ Project setup and configuration  
✅ Creating controllers with decorators  
✅ Adding authentication and authorization  
✅ Database integration with Drizzle ORM  
✅ Request validation with Zod  
✅ Rate limiting  
✅ Caching  

### 📚 Continue Learning

1. **[Decorators Guide](DECORATORS.md)** - Deep dive into all decorators
2. **[Architecture Guide](ARCHITECTURE.md)** - Understand the system design
3. **[Database Guide](DATABASE.md)** - Advanced database patterns
4. **[Authentication Guide](AUTH.md)** - Complete auth implementation
5. **[Testing Guide](TESTING.md)** - Write comprehensive tests

### 🚀 Build Something Awesome

Try building:
- **Blog API** - Posts, comments, likes
- **E-commerce API** - Products, cart, orders
- **Social Network API** - Users, friends, posts
- **Task Management API** - Projects, tasks, assignees

### 🤝 Get Help

- **Documentation**: [docs/](../)
- **Issues**: [GitHub Issues](https://github.com/Mad1Duck/hono-backend-template-decorator-style/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Mad1Duck/hono-backend-template-decorator-style/discussions)

---

**Congratulations!** 🎉 You've successfully set up and built your first API with the Hono Backend Template!

**Previous**: [README](../README.md) ← | **Next**: [Decorators Guide](DECORATORS.md) →