<div align="center">
  
# 🚀 Hono Backend Template - Decorator Style

**A modern, production-ready backend template built with Hono, TypeScript decorators, and dependency injection**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.0+-orange.svg)](https://hono.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.0+-black.svg)](https://bun.sh/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[Features](#-features) •
[Quick Start](#-quick-start) •
[Documentation](#-documentation) •
[Examples](#-examples) •
[Architecture](#-architecture)

</div>

---

## ✨ Features

### 🎨 **Decorator-Based Architecture**
- NestJS-inspired decorators for clean, declarative code
- Metadata-driven routing and dependency injection
- Type-safe parameter binding and validation

### 🔐 **Built-in Security**
- JWT authentication with role-based access control (RBAC)
- Permission-based authorization
- Rate limiting with Redis backend
- CORS and security headers out of the box

### 📊 **Observability**
- Structured logging with Pino (console + file + database)
- Prometheus metrics integration
- Request tracing with correlation IDs
- Activity logging for audit trails

### ⚡ **Performance**
- Redis caching with TTL support
- Connection pooling for database
- Optimized middleware chain
- Built for Bun runtime

### 🛠️ **Developer Experience**
- Hot reload in development
- Type-safe environment configuration
- Comprehensive error handling
- Zod validation schemas

---

## 📦 What's Included

```
hono-backend-template-decorator-style/
├── src/
│   ├── config/           # Configuration (env, cache, logger, security)
│   ├── core/             # Core framework (DI container, route builder)
│   ├── decorators/       # Decorators (route, guard, validation, etc.)
│   ├── middleware/       # Middleware (auth, logger, rate limit)
│   ├── platforms/        # Platform-specific routes (web, mobile)
│   ├── services/         # Business logic services
│   ├── db/              # Database schema and migrations
│   ├── utils/           # Utility functions
│   └── constants/       # Application constants
├── logs/                # Application logs
├── tests/              # Test files
└── docs/               # Documentation
```

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Redis](https://redis.io/) >= 6.0
- [PostgreSQL](https://www.postgresql.org/) >= 14.0 (or any SQL database)

### Installation

```bash
# Clone the repository
git clone https://github.com/Mad1Duck/hono-backend-template-decorator-style.git
cd hono-backend-template-decorator-style

# Install dependencies
bun install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
bun run db:migrate

# Start development server
bun run dev
```

The server will start at `http://localhost:3000`

### First API Call

```bash
# Health check
curl http://localhost:3000/health

# Get users (with rate limiting)
curl http://localhost:3000/api/web/v1/users
```

---

## 📖 Documentation

### Core Concepts

- **[Architecture Guide](docs/ARCHITECTURE.md)** - System architecture and design patterns
- **[Decorators Guide](docs/DECORATORS.md)** - Available decorators and usage
- **[Dependency Injection](docs/DEPENDENCY_INJECTION.md)** - DI container and service registration
- **[Middleware Guide](docs/MIDDLEWARE.md)** - Built-in and custom middleware

### Guides

- **[Getting Started](docs/GETTING_STARTED.md)** - Step-by-step tutorial
- **[Creating Controllers](docs/CREATING_CONTROLLERS.md)** - Controller patterns and best practices
- **[Authentication & Authorization](docs/AUTH.md)** - Security implementation guide
- **[Database & ORM](docs/DATABASE.md)** - Working with Drizzle ORM
- **[Caching Strategy](docs/CACHING.md)** - Redis caching patterns
- **[Logging](docs/LOGGING.md)** - Logging best practices

### Reference

- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation
- **[Configuration](docs/CONFIGURATION.md)** - Environment variables and settings
- **[Error Codes](docs/ERROR_CODES.md)** - Standard error codes and responses

---

## 🎯 Examples

### Basic Controller

```typescript
import { Controller, Get, Post, Injectable } from '@/decorators';
import { UserService } from '@/services/user.service';

@Controller('/users', { platform: 'web', version: 'v1' })
@Injectable()
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  @Public()
  async getAll() {
    return await this.userService.getAll();
  }

  @Post()
  @RequireAuth()
  @RateLimit({ max: 10, windowMs: 60000 })
  async create(@ValidatedBody(CreateUserSchema) dto: CreateUserDto) {
    return await this.userService.create(dto);
  }
}
```

### Authentication & Authorization

```typescript
@Controller('/admin', { platform: 'web', version: 'v1' })
@Injectable()
export class AdminController {
  // Require authentication
  @Get('/dashboard')
  @RequireAuth()
  async dashboard(@User() user: UserDto) {
    return { message: `Welcome ${user.name}` };
  }

  // Require specific role
  @Delete('/users/:id')
  @RequireRole('admin', 'superuser')
  async deleteUser(@Param('id') id: string) {
    return await this.userService.delete(id);
  }

  // Require permissions (ALL)
  @Post('/settings')
  @RequirePermission('settings:read', 'settings:write')
  async updateSettings(@Body() dto: SettingsDto) {
    return await this.settingsService.update(dto);
  }
}
```

### Rate Limiting

```typescript
@Controller('/auth', { platform: 'web', version: 'v1' })
@Injectable()
export class AuthController {
  // Strict rate limit for login
  @Post('/login')
  @RateLimit({ 
    max: 5, 
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many login attempts. Try again later.' 
  })
  async login(@ValidatedBody(LoginSchema) dto: LoginDto) {
    return await this.authService.login(dto);
  }

  // Per-user rate limit
  @Post('/search')
  @RateLimit({
    max: 100,
    windowMs: 3600000, // 1 hour
    keyGenerator: (c) => {
      const user = c.get('user');
      return user?.id || c.req.header('x-forwarded-for') || 'anonymous';
    }
  })
  async search(@Query() query: SearchDto) {
    return await this.searchService.search(query);
  }
}
```

### Caching

```typescript
@Controller('/products', { platform: 'web', version: 'v1' })
@Injectable()
export class ProductController {
  // Cache for 5 minutes
  @Get()
  @Cache({ ttl: 300 })
  async getAll() {
    return await this.productService.getAll();
  }

  // Invalidate cache on update
  @Put(':id')
  @RequireAuth()
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const result = await this.productService.update(id, dto);
    
    // Invalidate cache
    await this.cacheService.invalidate('products:*');
    
    return result;
  }
}
```

### Validation

```typescript
import { z } from 'zod';

// Define schema
const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
});

type CreateUserDto = z.infer<typeof CreateUserSchema>;

// Use in controller
@Post()
async create(
  @ValidatedBody(CreateUserSchema) dto: CreateUserDto,
  @User() currentUser: UserDto
) {
  // dto is fully typed and validated!
  return await this.userService.create(dto, currentUser);
}
```

---

## 🏗️ Architecture

### Request Flow

```
Request
  ↓
┌─────────────────────────────────────────┐
│       Global Middleware Stack           │
│  1. Request ID                          │
│  2. Logger (Pino)                       │
│  3. Global Rate Limiter (100/15min)     │
│  4. CORS & Security Headers             │
│  5. Metrics (Prometheus)                │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│      Route-Level Middleware             │
│  1. Class Middleware                    │
│  2. Method Middleware                   │
│  3. Rate Limiter (@RateLimit)           │
│  4. Guards (@RequireAuth, @RequireRole) │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│          Controller Method              │
│  • Parameter Resolution                 │
│  • Validation (Zod)                     │
│  • Business Logic                       │
│  • Response Formatting                  │
└─────────────────────────────────────────┘
  ↓
Response
```

### Dependency Injection

```typescript
// Services are auto-injected
@Injectable()
@Singleton()
class Database {
  connect() { /* ... */ }
}

@Injectable()
class UserService {
  // Database is auto-resolved and injected
  constructor(private db: Database) {}
  
  async getAll() {
    this.db.connect();
    // ...
  }
}

@Controller('/users')
@Injectable()
class UserController {
  // UserService is auto-resolved
  constructor(private userService: UserService) {}
}
```

---

## 🧪 Testing

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/unit/decorators/guard.test.ts

# Watch mode
bun test --watch
```

---

## 🔧 Available Scripts

```bash
# Development
bun run dev          # Start dev server with hot reload
bun run build        # Build for production
bun run start        # Start production server

# Database
bun run db:generate  # Generate migrations from schema
bun run db:migrate   # Run pending migrations
bun run db:studio    # Open Drizzle Studio (DB GUI)
bun run db:seed      # Seed database with sample data

# Testing
bun test            # Run tests
bun test:watch      # Run tests in watch mode
bun test:coverage   # Generate coverage report

# Code Quality
bun run lint        # Run ESLint
bun run lint:fix    # Fix ESLint issues
bun run format      # Format code with Prettier

# Utilities
bun run clean       # Clean build artifacts
bun run logs:clean  # Clean old log files
```

---

## 🌍 Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WHITELIST=127.0.0.1,::1

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_TO_DB=true
LOG_FILE_RETENTION_DAYS=30
LOG_DB_RETENTION_DAYS=30
```

See [Configuration Guide](docs/CONFIGURATION.md) for detailed explanations.

---

## 📊 Performance

### Benchmarks

```bash
# Requests per second (simple endpoint)
│ Stat      │ 2.5%  │ 50%   │ 97.5% │ 99%   │ Avg     │ Stdev   │ Max    │
├───────────┼───────┼───────┼───────┼───────┼─────────┼─────────┼────────┤
│ Req/Sec   │ 12,543│ 14,231│ 15,892│ 16,103│ 14,456  │ 892     │ 16,543 │
│ Latency   │ 2ms   │ 3ms   │ 7ms   │ 9ms   │ 3.2ms   │ 1.8ms   │ 45ms   │

# With auth + rate limiting
│ Stat      │ 2.5%  │ 50%   │ 97.5% │ 99%   │ Avg     │ Stdev   │ Max    │
├───────────┼───────┼───────┼───────┼───────┼─────────┼─────────┼────────┤
│ Req/Sec   │ 8,234 │ 9,845 │ 11,234│ 11,678│ 9,923   │ 678     │ 12,345 │
│ Latency   │ 4ms   │ 6ms   │ 12ms  │ 15ms  │ 6.5ms   │ 2.3ms   │ 67ms   │
```

### Optimization Tips

1. **Enable caching** for read-heavy endpoints
2. **Use rate limiting** to prevent abuse
3. **Database indexes** on frequently queried columns
4. **Connection pooling** for database and Redis
5. **Compression** middleware for large responses

---

## 🐳 Docker Support

```bash
# Build image
docker build -t hono-backend .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

See [Docker Guide](docs/DOCKER.md) for more details.

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier configurations
- Write tests for new features
- Add JSDoc comments for public APIs

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Hono](https://hono.dev/) - Ultrafast web framework
- [Bun](https://bun.sh/) - Fast all-in-one JavaScript runtime
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [Pino](https://getpino.io/) - Super fast logger

---

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/Mad1Duck/hono-backend-template-decorator-style/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Mad1Duck/hono-backend-template-decorator-style/discussions)

---

<div align="center">

**[⬆ back to top](#-hono-backend-template---decorator-style)**

Made with ❤️ by [Mad1Duck](https://github.com/Mad1Duck)

</div>