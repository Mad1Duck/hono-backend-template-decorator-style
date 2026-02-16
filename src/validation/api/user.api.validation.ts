/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { z } from 'zod';
/* ---------- UUID ---------- */

export const UUIDSchema =
  z.string().uuid();

/* ---------- PAGINATION ---------- */

/**
 * ?page=1&limit=10&search=test&sortBy=name&order=asc
 */
export const PaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Number(v ?? 1))
    .pipe(
      z.number().int().min(1).default(1)
    ),

  limit: z
    .string()
    .optional()
    .transform((v) => Number(v ?? 10))
    .pipe(
      z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(10)
    ),

  search: z
    .string()
    .trim()
    .min(1)
    .optional(),

  sortBy: z
    .enum([
      'name',
      'email',
      'createdAt',
    ])
    .optional()
    .default('createdAt'),

  order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
});

/* ---------- DATE RANGE ---------- */

export const DateRangeSchema = z
  .object({
    startDate: z
      .string()
      .datetime()
      .optional(),

    endDate: z
      .string()
      .datetime()
      .optional(),
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.endDate ||
      new Date(data.startDate) <=
      new Date(data.endDate),
    {
      message:
        'startDate must be before endDate',
      path: ['endDate'],
    }
  );

/* ---------- ID PARAM ---------- */

export const IdParamSchema = z.object({
  id: z.string().uuid(),
});
