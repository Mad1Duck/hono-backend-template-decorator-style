# MyService Service

Production-grade microservice with platform-specific APIs.

## Features

- 🚀 Hono framework
- 💾 Drizzle ORM
- 📱 Platform-specific APIs (mobile, web)
- 🔴 Redis caching
- ⚙️ BullMQ background jobs
- 🐰 RabbitMQ event-driven

## Setup

```bash
# Install dependencies
bun install

# Setup database
bunx drizzle-kit generate
bunx drizzle-kit push

# Start development server
bun dev

# Start worker (separate terminal)
bun dev:worker
```

## API Endpoints

### Mobile API
- Public: `/api/mobile/v1/public/*`
- Private: `/api/mobile/v1/private/*`

### Web API
- Public: `/api/web/v1/public/*`
- Private: `/api/web/v1/private/*`

## Structure

```
src/
├── config/              # Configuration with validation
├── platforms/           # Platform-specific code
│   ├── mobile/         # Mobile API
│   └── web/            # Web API
├── services/           # Business logic
├── repositories/       # Data access
│   └── base/           # Base repositories
├── validation/         # Validation schemas
│   ├── api/           # HTTP API validation
│   ├── queue/         # Queue job validation
│   └── messaging/    # Event validation
├── workers/           # Background workers
├── messaging/        # Publishers & consumers
└── types/              # Type definitions
```

## Commands

```bash
bun dev              # Start dev server
bun dev:worker       # Start worker
bun build            # Build for production
bun start            # Start production
bun db:generate      # Generate DB client
bun db:push          # Push schema to DB
bun db:studio        # Open DB studio
```


# Decorator Documentation

> Sistem decorator berbasis `reflect-metadata` untuk membangun routing, validasi, logging, caching, dan keamanan secara deklaratif.

---

## Daftar Isi

1. [Controller Decorators](#1-controller-decorators)
2. [HTTP Method Decorators](#2-http-method-decorators)
3. [Access Control Decorators](#3-access-control-decorators)
4. [Guard Decorators](#4-guard-decorators)
5. [Interceptor Decorators](#5-interceptor-decorators)
6. [Parameter Decorators](#6-parameter-decorators)
7. [OpenAPI Decorators](#7-openapi-decorators)
8. [Custom Utility Decorators](#8-custom-utility-decorators)
9. [Urutan Eksekusi Decorator](#9-urutan-eksekusi-decorator)
10. [Contoh Lengkap](#10-contoh-lengkap)

---

## 1. Controller Decorators

### `@Controller(basePath, options?)`

**File:** `decorator/controller.ts`

Mendaftarkan sebuah class sebagai HTTP controller dan mengkonfigurasi base path-nya. Metadata yang disimpan akan dibaca oleh `route-builder` untuk registrasi routing otomatis ke framework (Express/Fastify).

**Parameter:**

| Parameter | Tipe | Default | Keterangan |
|-----------|------|---------|------------|
| `basePath` | `string` | `''` | Path dasar untuk semua route di controller ini |
| `options.platform` | `'web' \| 'mobile'` | - | Prefix platform pada URL |
| `options.version` | `string` | `'v1'` | Versi API |

**Cara Kerja:**

Full path yang dihasilkan: `{platform}/{version}{basePath}`

```
@Controller('/users', { platform: 'web', version: 'v1' })
→ basePath = 'web/v1/users'

@Controller('/products')
→ basePath = '/products'  (tanpa platform prefix)
```

**Contoh Penggunaan:**

```typescript
// Dengan platform dan versi
@Controller('/users', { platform: 'web', version: 'v1' })
@Injectable()
export class UserController {}
// → route: /web/v1/users/...

// Hanya basePath
@Controller('/health')
export class HealthController {}
// → route: /health/...

// Dengan versi berbeda
@Controller('/orders', { platform: 'mobile', version: 'v2' })
export class OrderController {}
// → route: /mobile/v2/orders/...
```

---

## 2. HTTP Method Decorators

**File:** `decorator/controller.ts`

Semua HTTP method decorator dibuat oleh factory `createRouteDecorator`. Setiap decorator mendaftarkan route ke metadata class-nya.

### `@Get(path?, options?)`
### `@Post(path?, options?)`
### `@Put(path?, options?)`
### `@Patch(path?, options?)`
### `@Delete(path?, options?)`

**Parameter:**

| Parameter | Tipe | Default | Keterangan |
|-----------|------|---------|------------|
| `path` | `string` | `''` | Path relatif terhadap basePath controller |
| `options.platform` | `'mobile' \| 'web' \| 'all'` | `'all'` | Platform spesifik untuk route ini |
| `options.isPrivate` | `boolean` | `false` | Tandai route sebagai private |

**Contoh Penggunaan:**

```typescript
@Controller('/users', { platform: 'web', version: 'v1' })
export class UserController {

  @Get()                        // GET /web/v1/users
  async getAll() {}

  @Get(':id')                   // GET /web/v1/users/:id
  async getById() {}

  @Post()                       // POST /web/v1/users
  async create() {}

  @Put(':id')                   // PUT /web/v1/users/:id
  async update() {}

  @Patch(':id/status')          // PATCH /web/v1/users/:id/status
  async updateStatus() {}

  @Delete(':id')                // DELETE /web/v1/users/:id
  async delete() {}

  // Hanya aktif di platform mobile
  @Get('profile', { platform: 'mobile' })
  async getMobileProfile() {}
}
```

---

### `@Private()`

Mengubah flag `isPrivate` menjadi `true` pada route yang sudah didaftarkan oleh `@Get`, `@Post`, dll.

> **Catatan:** `@Private()` memodifikasi route yang sudah ada di array metadata, sehingga harus digunakan setelah HTTP method decorator (dieksekusi lebih dekat ke method).

```typescript
@Get(':id')
@Private()    // ← modifikasi route getById → isPrivate: true
async getById() {}
```

---

### `@Public()`

Menyimpan metadata `isPublic: true` langsung pada method (terpisah dari array routes). Dibaca oleh middleware auth untuk meng-skip pengecekan autentikasi.

```typescript
@Get()
@Public()     // ← middleware auth akan skip method ini
async getAll() {}
```

**Perbedaan `@Private()` vs `@Public()`:**

| Aspek | `@Private()` | `@Public()` |
|-------|-------------|-------------|
| Target | Memodifikasi array `routes` | Metadata terpisah di method |
| Cara baca | `Reflect.getMetadata(ROUTES, ctor)` | `Reflect.getMetadata('isPublic', target, key)` |
| Default | Semua route `isPrivate: false` | Tidak ada flag public secara default |

---

## 3. Access Control Decorators

**File:** `decorator/guard.ts`

### `@RequireAuth()`

Menambahkan `AuthGuard` ke daftar guards method. Route akan membutuhkan token autentikasi yang valid.

```typescript
@Get(':id')
@RequireAuth()
async getById(@ValidatedParam('id', z.string().uuid()) id: string) {
  return this.userService.getById(id);
}
```

---

### `@RequireRole(...roles)`

Menambahkan `RoleGuard` dengan daftar role yang diizinkan.

```typescript
@Delete(':id')
@RequireRole('admin')           // Hanya admin
async delete() {}

@Put(':id/promote')
@RequireRole('admin', 'manager') // Admin atau manager
async promoteUser() {}
```

---

### `@RequirePermission(...permissions)`

Menambahkan `PermissionGuard` dengan daftar permission spesifik.

```typescript
@Post('export')
@RequirePermission('users:export', 'data:read')
async exportUsers() {}
```

---

### `@RateLimit(options)`

Menyimpan konfigurasi rate limiting ke metadata method. Dibaca oleh middleware untuk membatasi jumlah request.

**Parameter:**

| Parameter | Tipe | Keterangan |
|-----------|------|------------|
| `max` | `number` | Maksimum request yang diizinkan |
| `windowMs` | `number` | Jendela waktu dalam millisecond |
| `skipSuccessful` | `boolean` | Tidak menghitung request yang berhasil |

```typescript
@Post()
@RateLimit({ max: 10, windowMs: 60000 })         // 10 req/menit
async create() {}

@Post('login')
@RateLimit({ max: 5, windowMs: 300000, skipSuccessful: true }) // 5 gagal/5menit
async login() {}
```

---

### `@UseGuards(...guards)`

Mendaftarkan guard class secara manual ke metadata method.

```typescript
class CustomGuard {
  canActivate() { /* logika custom */ }
}

@Get('sensitive')
@UseGuards(CustomGuard)
async sensitiveEndpoint() {}
```

---

## 4. Guard Decorators — Metadata yang Dihasilkan

Guards disimpan sebagai array di metadata:

```typescript
// Metadata yang tersimpan setelah:
@RequireAuth()
@RequireRole('admin')
async deleteUser() {}

// Hasil:
[
  { name: 'AuthGuard' },
  { name: 'RoleGuard', options: { roles: ['admin'] } }
]
```

---

## 5. Interceptor Decorators

**File:** `decorator/interceptor.ts`

Decorator yang **membungkus** (wrap) eksekusi method dengan logika tambahan.

### `@Cache(options)`

Menyimpan konfigurasi cache ke metadata method. Dieksekusi oleh `route-builder` atau middleware caching.

> **Catatan:** `@Cache` hanya menyimpan metadata — implementasi caching aktual ada di route-builder/middleware.

**Parameter:**

| Parameter | Tipe | Keterangan |
|-----------|------|------------|
| `ttl` | `number` | Time-to-live dalam detik |
| `key` | `string?` | Cache key kustom (opsional) |

```typescript
@Get()
@Cache({ ttl: 60 })             // Cache 60 detik
async getAll() {}

@Get(':id')
@Cache({ ttl: 300, key: 'user-detail' }) // Cache 5 menit dengan key kustom
async getById() {}
```

---

### `@LogActivity(action, options?)`

Membungkus method dan mengirim log sebelum dan/atau sesudah eksekusi menggunakan `this.logger` (jika ada) atau membuat logger baru dari nama class.

**Parameter:**

| Parameter | Tipe | Keterangan |
|-----------|------|------------|
| `action` | `string` | Label aksi yang dilog |
| `options.includeBody` | `boolean?` | Sertakan args/body dalam log |
| `options.includeResult` | `boolean?` | Sertakan hasil response dalam log |

**Cara Kerja:**

```
Request masuk
    ↓
LOG: "Activity: _GET" { action, handler, args? }
    ↓
Eksekusi method asli
    ↓
LOG: "Activity completed: _GET" { action, result }  ← jika includeResult: true
    ↓
Return result
```

```typescript
// Log sebelum saja
@LogActivity('_GET')
async getAll() {}

// Log sebelum + sertakan body
@LogActivity('_CREATED', { includeBody: true })
async create(@ValidatedBody(schema) dto: CreateDto) {}

// Log sebelum + sesudah dengan result
@LogActivity('_GET', { includeResult: true })
async getById() {}
```

**Output log:**
```json
// Sebelum eksekusi
{ "action": "_GET", "handler": "getAll", "level": "INFO", "context": "UserController" }

// Sesudah eksekusi (jika includeResult: true)
{ "action": "_GET", "result": { "id": "...", "name": "..." }, "level": "INFO" }
```

---

### `@TrackMetrics(options?)`

Mengukur durasi eksekusi method dan melaporkan ke `this.metrics` (jika ada). Melaporkan status `'success'` atau `'error'`.

**Parameter:**

| Parameter | Tipe | Default | Keterangan |
|-----------|------|---------|------------|
| `options.name` | `string?` | `ClassName.methodName` | Nama metrik kustom |

```typescript
@Get()
@TrackMetrics()                              // metrik: "UserController.getAll"
async getAll() {}

@Post()
@TrackMetrics({ name: 'user_creation' })    // metrik: "user_creation"
async create() {}
```

**Data yang dilaporkan ke `metrics.trackMethodDuration`:**
```
name: "UserController.getAll"
duration: 145  (ms)
status: "success" | "error"
```

---

### `@Transform(transformer)`

Mengubah hasil return value method menggunakan fungsi transformer sebelum dikirim ke response.

```typescript
// Hapus field sensitif dari response
@Get()
@Transform((users: User[]) => users.map(u => omit(u, ['password', 'token'])))
async getAll() {}

// Ubah format response
@Get(':id')
@Transform((user: User) => ({
  ...user,
  fullName: `${user.firstName} ${user.lastName}`,
  createdAt: user.createdAt.toISOString(),
}))
async getById() {}
```

---

### `@Retry(options)`

Otomatis mengulang eksekusi method jika terjadi error, dengan konfigurasi delay dan backoff strategy.

**Parameter:**

| Parameter | Tipe | Default | Keterangan |
|-----------|------|---------|------------|
| `attempts` | `number` | - | Jumlah maksimum percobaan |
| `delay` | `number?` | `1000` | Delay awal dalam ms |
| `backoff` | `'exponential' \| 'linear'` | - | Strategi penambahan delay |

**Delay calculation:**
- `linear`: `delay * attempt` → 1s, 2s, 3s
- `exponential`: `delay * 2^(attempt-1)` → 1s, 2s, 4s, 8s

```typescript
// 3 percobaan, delay 500ms linear
@Post('webhook')
@Retry({ attempts: 3, delay: 500, backoff: 'linear' })
async processWebhook() {}

// 4 percobaan, delay exponential
@Post('send-email')
@Retry({ attempts: 4, delay: 1000, backoff: 'exponential' })
// delay: 1s → 2s → 4s → (throw)
async sendEmail() {}
```

---

### `@Timeout(ms)`

Membatasi waktu eksekusi method. Jika melebihi batas, throw `Error: Timeout after {ms}ms`.

```typescript
@Get('report')
@Timeout(5000)   // Maksimum 5 detik
async generateReport() {}

@Post('upload')
@Timeout(30000)  // Maksimum 30 detik untuk upload
async uploadFile() {}
```

---

## 6. Parameter Decorators

**File:** `decorator/param.ts`

Mendaftarkan sumber data parameter method ke metadata. Dibaca oleh `route-builder` untuk meng-inject nilai yang tepat saat request masuk.

### Decorator Dasar

| Decorator | Sumber Data | Keterangan |
|-----------|-------------|------------|
| `@Body(schema?)` | `req.body` | Request body |
| `@Query(schema?)` | `req.query` | Query string |
| `@Param(name, schema?)` | `req.params` | URL parameter |
| `@Headers(name?)` | `req.headers` | Request headers |
| `@User()` | `req.user` | User dari auth middleware |
| `@Req()` | `req` | Raw request object |
| `@Res()` | `res` | Raw response object |
| `@Next()` | `next` | Express next function |

```typescript
async create(
  @Body() body: any,                    // seluruh body
  @Query('page') page: string,          // query ?page=...
  @Param('id') id: string,              // URL :id
  @Headers('authorization') token: string,
  @User() currentUser: UserEntity,
  @Req() req: Request,
) {}
```

---

### Validated Decorators (Type-Safe)

Decorator yang menambahkan Zod schema untuk validasi otomatis sebelum data diinjeksikan ke parameter.

#### `@ValidatedBody(schema)`

```typescript
import { CreateUserSchema, type CreateUserDto } from '@/types/user.schema';

async create(
  @ValidatedBody(CreateUserSchema) dto: CreateUserDto
) {
  // dto sudah divalidasi dan memiliki tipe CreateUserDto
}
```

#### `@ValidatedQuery(schema)`

```typescript
import { PaginationSchema, type PaginationDto } from '@/types/common.schema';

async getAll(
  @ValidatedQuery(PaginationSchema) query: PaginationDto
) {
  // query.page, query.limit sudah tervalidasi
}
```

#### `@ValidatedParam(name, schema)`

```typescript
async getById(
  @ValidatedParam('id', z.string().uuid()) id: string
) {
  // id sudah divalidasi sebagai UUID
}
```

---

## 7. OpenAPI Decorators

**File:** `decorator/openapi.ts`

Decorator untuk menghasilkan dokumentasi OpenAPI/Swagger secara otomatis dari metadata.

### `@ApiDoc(metadata)`

Metadata utama untuk endpoint.

```typescript
@Get(':id')
@ApiDoc({
  summary: 'Get user by ID',
  description: 'Retrieve a single user by their UUID. Requires authentication.',
  deprecated: false,
})
async getById() {}
```

---

### `@ApiResponse(statusCode, description, schema?)`

Mendokumentasikan response yang mungkin dikembalikan endpoint. Bisa digunakan berkali-kali.

```typescript
@Post()
@ApiResponse(201, 'User created successfully', CreateUserResponseSchema)
@ApiResponse(400, 'Validation failed')
@ApiResponse(409, 'Email already exists')
async create() {}
```

---

### `@ApiTags(...tags)`

Mengelompokkan endpoint dalam dokumentasi Swagger. Bisa digunakan di class (semua route) atau method (route spesifik).

```typescript
// Di class → semua route dalam controller masuk grup 'users'
@Controller('/users', { platform: 'web', version: 'v1' })
@ApiTags('users')
export class UserController {

  // Di method → tambah tag spesifik untuk route ini
  @Get('search')
  @ApiTags('search')
  async search() {}
}
```

---

### `@ApiDeprecated()`

Menandai endpoint sebagai deprecated dalam dokumentasi.

```typescript
@Get('old-endpoint')
@ApiDeprecated()
@ApiDoc({ summary: 'DEPRECATED: Use /new-endpoint instead' })
async oldEndpoint() {}
```

---

## 8. Custom Utility Decorators

**File:** `decorator/custom.ts`

### `@Throttle(ms)`

Membatasi frekuensi pemanggilan method — berbeda dari `@RateLimit` yang per-request, `@Throttle` bersifat global untuk semua instance.

> **Catatan:** `lastCall` disimpan di closure, jadi berlaku untuk **semua** instance class.

```typescript
// Method hanya bisa dipanggil setiap 2 detik
@Throttle(2000)
async syncData() {}
```

---

### `@Memoize(options?)`

Cache hasil return value berdasarkan argumen yang diberikan. Cocok untuk operasi expensive yang sering dipanggil dengan argumen sama.

**Parameter:**

| Parameter | Tipe | Keterangan |
|-----------|------|------------|
| `options.ttl` | `number?` | TTL cache dalam ms. Tanpa TTL = cache selamanya |

```typescript
// Cache tanpa expired
@Memoize()
async getCountriesList() {}

// Cache 5 menit
@Memoize({ ttl: 300000 })
async getUserPermissions(userId: string) {}
```

---

### `@ValidateResult(schema)`

Memvalidasi return value method menggunakan Zod schema. Berguna untuk memastikan response sesuai kontrak API.

```typescript
@Get()
@ValidateResult(UserListResponseSchema)
async getAll() {
  return this.userService.getAll();
  // Response akan divalidasi sebelum dikirim
}
```

---

### `@Audit(options)`

Mencatat log audit sebelum eksekusi method. Berguna untuk tracking perubahan data penting.

```typescript
@Delete(':id')
@Audit({ action: 'USER_DELETED' })
async delete() {}
// Log: { action: 'USER_DELETED', user: currentUserId, timestamp: '...', method: 'UserController.delete' }
```

---

### `@Transaction()`

Membungkus eksekusi method dalam database transaction. Method dieksekusi dalam `this.db.transaction()`.

> **Requirement:** Class harus memiliki property `db` yang implement interface dengan method `transaction()`.

```typescript
@Post()
@Transaction()
async createWithRelations(dto: CreateDto) {
  // Semua operasi db di sini berjalan dalam satu transaction
  const user = await this.userRepo.create(dto);
  await this.profileRepo.create({ userId: user.id });
  return user;
  // Jika error → otomatis rollback
}
```

---

## 9. Urutan Eksekusi Decorator

Decorator TypeScript dieksekusi **dari bawah ke atas** (bottom-up):

```typescript
@Get()              // ← eksekusi ke-4 (terluar)
@Public()           // ← eksekusi ke-3
@TrackMetrics()     // ← eksekusi ke-2
@LogActivity('_GET')// ← eksekusi ke-1 (terdalam, wrap method asli)
async getAll() {}
```

**Stack eksekusi saat request masuk:**
```
TrackMetrics wrapper
  └─ LogActivity wrapper
       └─ getAll() (method asli)
  ↑ return & track duration
↑ return & log result
```

---

## 10. Contoh Lengkap

### Controller dengan semua decorator

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Public, RequireAuth, RequireRole,
  Cache, LogActivity, TrackMetrics,
  RateLimit, ApiDoc, ApiResponse, ApiTags,
  ValidatedBody, ValidatedQuery, ValidatedParam,
  User, Transform, Retry, Timeout,
} from '@/decorators';
import { z } from 'zod';

@Controller('/users', { platform: 'web', version: 'v1' })
@ApiTags('users')
@Injectable()
export class UserController {
  constructor(private userService: UserService) {}

  // ──────────────── GET ALL ────────────────
  @Get()
  @Public()
  @Cache({ ttl: 60 })
  @TrackMetrics()
  @LogActivity('_GET', { includeResult: true })
  @Transform((users: User[]) => users.map(u => omit(u, ['password'])))
  @ApiDoc({ summary: 'Get all users' })
  @ApiResponse(200, 'Users retrieved successfully')
  async getAll(
    @ValidatedQuery(PaginationSchema) query: PaginationDto
  ) {
    return this.userService.getAll(query);
  }

  // ──────────────── GET BY ID ────────────────
  @Get(':id')
  @RequireAuth()
  @Cache({ ttl: 300 })
  @Timeout(5000)
  @ApiDoc({ summary: 'Get user by ID' })
  @ApiResponse(200, 'User found')
  @ApiResponse(404, 'User not found')
  async getById(
    @ValidatedParam('id', z.string().uuid()) id: string
  ) {
    return this.userService.getById(id);
  }

  // ──────────────── CREATE ────────────────
  @Post()
  @RequireAuth()
  @RateLimit({ max: 10, windowMs: 60000 })
  @LogActivity('_CREATED', { includeBody: true })
  @TrackMetrics({ name: 'user_creation' })
  @Retry({ attempts: 3, delay: 500, backoff: 'linear' })
  @ApiDoc({ summary: 'Create new user' })
  @ApiResponse(201, 'User created')
  @ApiResponse(400, 'Validation failed')
  async create(
    @ValidatedBody(CreateUserSchema) dto: CreateUserDto,
    @User() currentUser: UserEntity
  ) {
    return this.userService.create(dto, currentUser);
  }

  // ──────────────── UPDATE ────────────────
  @Put(':id')
  @RequireAuth()
  @LogActivity('_UPDATED')
  @TrackMetrics()
  @ApiDoc({ summary: 'Update user' })
  async update(
    @ValidatedParam('id', z.string().uuid()) id: string,
    @ValidatedBody(UpdateUserSchema) dto: UpdateUserDto,
    @User() currentUser: UserEntity
  ) {
    return this.userService.update(id, dto, currentUser);
  }

  // ──────────────── DELETE ────────────────
  @Delete(':id')
  @RequireRole('admin')
  @LogActivity('_DELETED')
  @TrackMetrics()
  @ApiDoc({ summary: 'Delete user' })
  @ApiResponse(200, 'User deleted')
  @ApiResponse(403, 'Forbidden')
  async delete(
    @ValidatedParam('id', z.string().uuid()) id: string,
    @User() currentUser: UserEntity
  ) {
    await this.userService.delete(id, currentUser);
    return { message: 'User deleted successfully' };
  }
}
```

---

## Ringkasan Referensi Cepat

| Decorator | File | Fungsi |
|-----------|------|--------|
| `@Controller` | controller.ts | Daftarkan class sebagai controller + set base path |
| `@Get/Post/Put/Patch/Delete` | controller.ts | Daftarkan HTTP route |
| `@Private` | controller.ts | Tandai route sebagai private |
| `@Public` | controller.ts | Skip auth middleware |
| `@RequireAuth` | guard.ts | Wajib autentikasi |
| `@RequireRole` | guard.ts | Wajib role tertentu |
| `@RequirePermission` | guard.ts | Wajib permission tertentu |
| `@RateLimit` | guard.ts | Batasi jumlah request |
| `@UseGuards` | guard.ts | Pasang guard custom |
| `@Cache` | interceptor.ts | Konfigurasi caching |
| `@LogActivity` | interceptor.ts | Log aktivitas request/response |
| `@TrackMetrics` | interceptor.ts | Ukur durasi eksekusi |
| `@Transform` | interceptor.ts | Ubah return value |
| `@Retry` | interceptor.ts | Auto-retry jika error |
| `@Timeout` | interceptor.ts | Batasi waktu eksekusi |
| `@Body/Query/Param` | param.ts | Inject data dari request |
| `@ValidatedBody/Query/Param` | param.ts | Inject + validasi Zod |
| `@User` | param.ts | Inject user dari auth |
| `@ApiDoc` | openapi.ts | Dokumentasi endpoint |
| `@ApiResponse` | openapi.ts | Dokumentasi response |
| `@ApiTags` | openapi.ts | Kelompokkan endpoint |
| `@ApiDeprecated` | openapi.ts | Tandai deprecated |
| `@Throttle` | custom.ts | Batasi frekuensi global |
| `@Memoize` | custom.ts | Cache berdasarkan args |
| `@ValidateResult` | custom.ts | Validasi return value |
| `@Audit` | custom.ts | Log audit trail |
| `@Transaction` | custom.ts | Wrap dalam DB transaction |