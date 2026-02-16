// middleware/auth.middleware.ts
import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env.config';
import { logger } from '@/config/logger.config';
import type { MiddlewareClass } from '@/decorators/middleware';

/* ================= TYPES ================= */

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
  roles?: string[]; // Support multiple roles
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export type HonoMiddlewareFn = (
  c: Context,
  next: Next
) => Promise<Response | void>;

/* ================= AUTH MIDDLEWARE (CLASS-BASED) ================= */

/**
 * Class-based auth middleware
 * Use with: @Middleware(AuthMiddleware)
 */
export class AuthMiddleware implements MiddlewareClass {
  async use(c: Context, next: Next): Promise<Response | void> {
    try {
      // Extract token from Authorization header
      const authHeader = c.req.header('authorization');
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

      if (!token) {
        return c.json(
          {
            status: 'error',
            error: {
              code: 'UNAUTHORIZED',
              message: 'No token provided',
            },
          },
          401
        );
      }

      // Verify JWT token
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

      // Normalize roles (support both `role` and `roles`)
      if (payload.role && !payload.roles) {
        payload.roles = [payload.role];
      }

      // Store user in context
      c.set('user', payload);

      logger.debug(
        {
          userId: payload.userId,
          email: payload.email,
          roles: payload.roles,
        },
        'User authenticated'
      );

      await next();
    } catch (error) {
      logger.error({ err: error }, 'Authentication failed');

      // Handle specific JWT errors
      if (error instanceof jwt.TokenExpiredError) {
        return c.json(
          {
            status: 'error',
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Token has expired',
            },
          },
          401
        );
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return c.json(
          {
            status: 'error',
            error: {
              code: 'INVALID_TOKEN',
              message: 'Invalid token',
            },
          },
          401
        );
      }

      // Generic auth error
      return c.json(
        {
          status: 'error',
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed',
          },
        },
        401
      );
    }
  }
}

/* ================= ROLE MIDDLEWARE (FACTORY) ================= */

/**
 * Require specific roles (supports multiple)
 * Use with: @Middleware(RequireRole('admin', 'moderator'))
 */
export function RequireRole(...roles: string[]): HonoMiddlewareFn {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthPayload | undefined;

    // Check if user is authenticated
    if (!user) {
      return c.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        },
        401
      );
    }

    // Check if user has any of the required roles
    const userRoles = user.roles || (user.role ? [user.role] : []);
    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      logger.warn(
        {
          userId: user.userId,
          requiredRoles: roles,
          userRoles,
        },
        'Insufficient permissions - role check failed'
      );

      return c.json(
        {
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: `Requires one of the following roles: ${roles.join(', ')}`,
          },
        },
        403
      );
    }

    await next();
  };
}

/* ================= PERMISSION MIDDLEWARE (FACTORY) ================= */

/**
 * Require specific permissions (must have ALL)
 * Use with: @Middleware(RequirePermission('users:read', 'users:write'))
 */
export function RequirePermission(...permissions: string[]): HonoMiddlewareFn {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthPayload | undefined;

    // Check if user is authenticated
    if (!user) {
      return c.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        },
        401
      );
    }

    // Check if user has all required permissions
    const userPermissions = user.permissions ?? [];
    const hasAllPermissions = permissions.every((p) =>
      userPermissions.includes(p)
    );

    if (!hasAllPermissions) {
      const missingPermissions = permissions.filter(
        (p) => !userPermissions.includes(p)
      );

      logger.warn(
        {
          userId: user.userId,
          requiredPermissions: permissions,
          userPermissions,
          missingPermissions,
        },
        'Missing required permissions'
      );

      return c.json(
        {
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: `Missing permissions: ${missingPermissions.join(', ')}`,
          },
        },
        403
      );
    }

    await next();
  };
}

/* ================= PERMISSION ANY (FACTORY) ================= */

/**
 * Require at least ONE of the specified permissions
 * Use with: @Middleware(RequireAnyPermission('users:read', 'users:write'))
 */
export function RequireAnyPermission(
  ...permissions: string[]
): HonoMiddlewareFn {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthPayload | undefined;

    if (!user) {
      return c.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated',
          },
        },
        401
      );
    }

    const userPermissions = user.permissions ?? [];
    const hasAnyPermission = permissions.some((p) =>
      userPermissions.includes(p)
    );

    if (!hasAnyPermission) {
      logger.warn(
        {
          userId: user.userId,
          requiredPermissions: permissions,
          userPermissions,
        },
        'No matching permissions'
      );

      return c.json(
        {
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: `Requires one of: ${permissions.join(', ')}`,
          },
        },
        403
      );
    }

    await next();
  };
}

/* ================= OPTIONAL AUTH (FACTORY) ================= */

/**
 * Optional authentication - doesn't fail if no token
 * Use with: @Middleware(OptionalAuth)
 */
export async function OptionalAuth(c: Context, next: Next): Promise<void> {
  try {
    const authHeader = c.req.header('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (token) {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

      // Normalize roles
      if (payload.role && !payload.roles) {
        payload.roles = [payload.role];
      }

      c.set('user', payload);

      logger.debug(
        { userId: payload.userId },
        'Optional auth: User authenticated'
      );
    } else {
      logger.debug('Optional auth: No token provided');
    }
  } catch (error) {
    logger.warn({ err: error }, 'Optional auth: Invalid token (ignored)');
  }

  await next();
}

/* ================= API KEY AUTH (FACTORY) ================= */

/**
 * API Key authentication
 * Use with: @Middleware(RequireApiKey)
 */
export async function RequireApiKey(c: Context, next: Next): Promise<Response | void> {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json(
      {
        status: 'error',
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key is required',
        },
      },
      401
    );
  }

  const validApiKeys = env?.API_KEYS?.split(',') || [];

  if (!validApiKeys.includes(apiKey)) {
    logger.warn({ apiKey: apiKey.substring(0, 8) + '...' }, 'Invalid API key');

    return c.json(
      {
        status: 'error',
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
        },
      },
      403
    );
  }

  logger.debug({ apiKey: apiKey.substring(0, 8) + '...' }, 'API key validated');

  await next();
}