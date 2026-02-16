/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { ZodError } from 'zod';

import { container } from './container';
import {
  METADATA_KEYS,
  RouteMetadata,
  ParamMetadata,
  GuardMetadata,
  RateLimitMetadata,
  HonoMiddlewareFn,
} from '../decorators/metadata';
import { createRateLimiter } from '@/middleware/rateLimit.middleware';
import { executeGuards } from '@/middleware/guard.middleware';

/* ================= TYPES ================= */

type Constructor<T = unknown> = abstract new (...args: any[]) => T;
type ConcreteConstructor<T = unknown> = new (...args: any[]) => T;
type ControllerInstance = Record<string, (...args: unknown[]) => unknown>;

type HonoMethod = (
  path: string,
  ...handlers: HonoMiddlewareFn[]
) => void;

/* ================= ROUTE BUILDER (HONO) ================= */

export class HonoRouteBuilder {
  /* ---------- BUILD ---------- */

  static build<T>(
    ControllerClass: Constructor<T>,
    platform?: 'mobile' | 'web'
  ): Hono {
    const app = new Hono();

    /* ----- Controller Metadata ----- */
    const controllerMetadata = Reflect.getMetadata(
      METADATA_KEYS.CONTROLLER,
      ControllerClass
    ) as { basePath: string; } | undefined;

    const routes = Reflect.getMetadata(
      METADATA_KEYS.ROUTES,
      ControllerClass
    ) as RouteMetadata[] | undefined;

    if (!controllerMetadata || !routes) {
      return app;
    }

    /* ----- Resolve Controller Instance ----- */
    const controllerInstance = container.resolve(
      ControllerClass as unknown as ConcreteConstructor<T>
    ) as ControllerInstance;

    /* ----- Filter Routes by Platform ----- */
    const platformRoutes = routes.filter((route) => {
      if (!platform) return true;
      return route.platform === 'all' || route.platform === platform;
    });

    /* ----- Register Routes ----- */
    for (const route of platformRoutes) {
      this.registerRoute(
        app,
        route,
        controllerInstance,
        controllerMetadata.basePath
      );
    }

    return app;
  }

  /* ---------- REGISTER ROUTE ---------- */

  private static registerRoute(
    app: Hono,
    route: RouteMetadata,
    controllerInstance: ControllerInstance,
    basePath: string
  ): void {
    const { method, path, handlerName } = route;
    const proto = Object.getPrototypeOf(controllerInstance);

    /* ----- Check if route is public ----- */
    const isPublic = Reflect.getMetadata(
      'isPublic',
      proto,
      handlerName
    ) as boolean | undefined;

    /* ----- Get Rate Limit Metadata ----- */
    const rateLimitMeta = Reflect.getMetadata(
      METADATA_KEYS.RATE_LIMIT,
      proto,
      handlerName
    ) as RateLimitMetadata | undefined;

    /* ----- Build Middleware Chain ----- */
    const middlewares: HonoMiddlewareFn[] = [];

    if (rateLimitMeta) {
      middlewares.push(async (c: Context, next: () => void) => {
        c.set('hasDecoratorRateLimit', true);
        await next();
      });
    }

    /* ----- Collect Middlewares ----- */
    const classMiddlewares = isPublic
      ? []
      : (Reflect.getMetadata(
        METADATA_KEYS.MIDDLEWARES,
        proto.constructor
      ) as HonoMiddlewareFn[] | undefined) ?? [];

    const methodMiddlewares = isPublic
      ? []
      : (Reflect.getMetadata(
        METADATA_KEYS.MIDDLEWARES,
        proto,
        handlerName
      ) as HonoMiddlewareFn[] | undefined) ?? [];

    /* ----- Get Parameter Metadata ----- */
    const params = (Reflect.getMetadata(
      METADATA_KEYS.PARAMS,
      controllerInstance,
      handlerName
    ) as ParamMetadata[] | undefined) ?? [];

    /* ----- Get Guards Metadata ----- */
    const guards = (Reflect.getMetadata(
      METADATA_KEYS.GUARDS,
      proto,
      handlerName
    ) as GuardMetadata[] | undefined) ?? [];

    // 1. Class-level middlewares
    middlewares.push(...classMiddlewares);

    // 2. Method-level middlewares
    middlewares.push(...methodMiddlewares);

    // 3. Rate limiting middleware (if decorator is present)
    if (rateLimitMeta) {
      const rateLimitMiddleware = createRateLimiter({
        max: rateLimitMeta.max,
        windowMs: rateLimitMeta.windowMs,
        keyPrefix: rateLimitMeta.keyPrefix || `rl:route:${handlerName}:`,
        message: rateLimitMeta.message,
        keyGenerator: rateLimitMeta.keyGenerator,
      });

      middlewares.push(rateLimitMiddleware);
    }

    // 4. Guards middleware (auth, role, permission)
    if (guards.length > 0) {
      const guardMiddleware = async (c: Context, next: () => void) => {
        try {
          const canActivate = await executeGuards(c, guards);

          if (!canActivate) {
            return c.json(
              {
                status: 'error',
                error: {
                  code: 'FORBIDDEN',
                  message: 'Access denied',
                },
              },
              403
            );
          }

          await next();
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('Unauthorized')) {
              return c.json(
                {
                  status: 'error',
                  error: {
                    code: 'UNAUTHORIZED',
                    message: error.message,
                  },
                },
                401
              );
            }

            if (error.message.includes('Forbidden')) {
              return c.json(
                {
                  status: 'error',
                  error: {
                    code: 'FORBIDDEN',
                    message: error.message,
                  },
                },
                403
              );
            }
          }

          throw error;
        }
      };
      middlewares.push(guardMiddleware as HonoMiddlewareFn);
    }
    /* ----- Register Route with Middlewares ----- */
    (app[method] as HonoMethod)(
      `${basePath}${path}`,
      ...middlewares,
      async (c: Context) => {
        try {
          // Inject context into controller instance
          (controllerInstance as Record<string, unknown>)['__ctx'] = c;

          // Resolve parameters from request
          const args = await this.resolveParameters(params, c);

          // Get handler function
          const fn = controllerInstance[handlerName];

          if (typeof fn !== 'function') {
            throw new Error(`Handler ${handlerName} not found`);
          }

          // Execute handler
          const result = await fn.apply(controllerInstance, args);

          // Clean up context
          delete (controllerInstance as Record<string, unknown>)['__ctx'];

          // Return response
          if (result !== undefined) {
            return c.json(result);
          }

          return c.body(null);
        } catch (error: unknown) {
          // Clean up context on error
          delete (controllerInstance as Record<string, unknown>)['__ctx'];

          // Handle validation errors
          if (error instanceof ZodError) {
            return c.json(
              {
                status: 'error',
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Validation failed',
                  details: error.errors,
                },
              },
              400
            );
          }

          // Re-throw other errors (handled by global error handler)
          throw error;
        }
      }
    );
  }

  /* ---------- PARAM RESOLVER ---------- */

  private static async resolveParameters(
    params: ParamMetadata[],
    c: Context
  ): Promise<unknown[]> {
    const args: unknown[] = [];

    // Initialize array with undefined values
    params
      .sort((a, b) => a.index - b.index)
      .forEach((p) => {
        args[p.index] = undefined;
      });

    // Resolve each parameter
    for (const param of params) {
      let value: unknown;

      switch (param.type) {
        case 'body': {
          const body = await c.req.json();
          value = param.schema ? await param.schema.parseAsync(body) : body;
          break;
        }

        case 'param': {
          const raw = param.name ? c.req.param(param.name) : c.req.param();
          value =
            param.schema && param.name
              ? await param.schema.parseAsync(raw)
              : raw;
          break;
        }

        case 'query': {
          const query = c.req.query();
          value = param.schema ? await param.schema.parseAsync(query) : query;
          break;
        }

        case 'headers': {
          value = param.name ? c.req.header(param.name) : c.req.header();
          break;
        }

        case 'user': {
          // Get user from context (set by auth middleware/guard)
          value = c.get('user');
          break;
        }

        case 'req': {
          value = c.req;
          break;
        }

        case 'res': {
          value = c;
          break;
        }

        case 'next': {
          // Not typically used in controller handlers
          value = undefined;
          break;
        }

        default:
          value = undefined;
      }

      args[param.index] = value;
    }

    return args;
  }
}