import { Context } from 'hono';
import { GuardMetadata } from '@/decorators/metadata';
import { AuthPayload } from './auth.middleware';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env.config';
import { logger } from '@/config/logger.config';

/**
 * Execute guards in order
 */
export async function executeGuards(
  c: Context,
  guards: GuardMetadata[]
): Promise<boolean> {
  for (const guard of guards) {
    const canActivate = await checkGuard(c, guard);

    if (!canActivate) {
      return false;
    }
  }

  return true;
}

/**
 * Check individual guard
 */
async function checkGuard(c: Context, guard: GuardMetadata): Promise<boolean> {
  switch (guard.name) {
    case 'AuthGuard':
      return await checkAuth(c);

    case 'RoleGuard':
      return await checkRole(
        c,
        guard.options?.roles,
        guard.options?.requireAll
      );

    case 'PermissionGuard':
      return await checkPermission(
        c,
        guard.options?.permissions,
        guard.options?.requireAll
      );

    default:
      logger.warn(`Unknown guard: ${guard.name}`);
      return true;
  }
}

/**
 * Check if user is authenticated
 */
async function checkAuth(c: Context): Promise<boolean> {
  const existingUser = c.get('user') as AuthPayload | undefined;
  if (existingUser) {
    return true;
  }

  const authHeader = c.req.header('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  if (!token) {
    throw new Error('Unauthorized: No token provided');
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;

    if (payload.role && !payload.roles) {
      payload.roles = [payload.role];
    }

    c.set('user', payload);
    return true;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Unauthorized: Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Unauthorized: Invalid token');
    }
    throw new Error('Unauthorized: Authentication failed');
  }
}

/**
 * Check if user has required role(s)
 * @param requireAll - If true, user must have ALL roles. If false, user needs at least ONE role.
 */
async function checkRole(
  c: Context,
  requiredRoles?: string[],
  requireAll = false
): Promise<boolean> {
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  const user = c.get('user') as AuthPayload | undefined;

  if (!user) {
    throw new Error('Unauthorized: User not found');
  }

  const userRoles = user.roles || (user.role ? [user.role] : []);

  let hasRequiredRoles: boolean;

  if (requireAll) {
    hasRequiredRoles = requiredRoles.every((role) => userRoles.includes(role));
  } else {
    hasRequiredRoles = requiredRoles.some((role) => userRoles.includes(role));
  }

  if (!hasRequiredRoles) {
    const message = requireAll
      ? `Forbidden: Requires all roles: ${requiredRoles.join(', ')}`
      : `Forbidden: Requires one of: ${requiredRoles.join(', ')}`;

    throw new Error(message);
  }

  return true;
}

/**
 * Check if user has required permission(s)
 * @param requireAll - If true, user must have ALL permissions. If false, user needs at least ONE.
 */
async function checkPermission(
  c: Context,
  requiredPermissions?: string[],
  requireAll = true
): Promise<boolean> {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  const user = c.get('user') as AuthPayload | undefined;

  if (!user) {
    throw new Error('Unauthorized: User not found');
  }

  const userPermissions = user.permissions || [];

  let hasRequiredPermissions: boolean;

  if (requireAll) {
    hasRequiredPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );
  } else {
    hasRequiredPermissions = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );
  }

  if (!hasRequiredPermissions) {
    const missing = requireAll
      ? requiredPermissions.filter((p) => !userPermissions.includes(p))
      : [];

    const message = requireAll
      ? `Forbidden: Missing permissions: ${missing.join(', ')}`
      : `Forbidden: Requires one of: ${requiredPermissions.join(', ')}`;

    throw new Error(message);
  }

  return true;
}