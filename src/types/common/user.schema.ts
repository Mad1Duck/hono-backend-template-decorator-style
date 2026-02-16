import { z } from 'zod';
/**
 * Pagination & filter query
 * ?page=1&limit=10&search=john&sortBy=name&order=asc
 */
export const PaginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Number(v ?? 1))
    .pipe(
      z
        .number()
        .int()
        .min(1)
        .default(1)
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
    .enum(['name', 'email', 'createdAt'])
    .optional()
    .default('createdAt'),

  order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
});

/* ================= DTO ================= */

export type PaginationDto =
  z.infer<typeof PaginationSchema>;

/* ================= USER CREATE ================= */

export const CreateUserSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100),

  email: z
    .string()
    .email(),

  password: z
    .string()
    .min(8),
});

export type CreateUserDto =
  z.infer<typeof CreateUserSchema>;

/* ================= USER UPDATE ================= */

export const UpdateUserSchema =
  CreateUserSchema.partial();

export type UpdateUserDto =
  z.infer<typeof UpdateUserSchema>;
