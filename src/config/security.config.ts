// config/security.config.ts
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { env } from './env.config';

/**
 * Security Headers Middleware (Hono equivalent of Helmet)
 */
export const securityHeadersMiddleware = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: 'same-site',
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  xContentTypeOptions: 'nosniff',
  xFrameOptions: 'DENY',
  xXssProtection: '1; mode=block',
});

/**
 * CORS Middleware (Hono)
 */
export const corsMiddleware = cors({
  origin: (origin) => {
    const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
    ];

    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return origin;

    if (allowedOrigins.includes('*')) return origin;

    if (allowedOrigins.includes(origin)) return origin;

    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400,
});

/**
 * Alternative: Simple CORS for Development
 */
export const devCorsMiddleware = cors({
  origin: '*',
  credentials: true,
});

/**
 * Alternative: Production CORS (strict whitelist)
 */
export const prodCorsMiddleware = cors({
  origin: env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-ID'],
  maxAge: 86400,
});