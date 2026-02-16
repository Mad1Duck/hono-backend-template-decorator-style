import { Hono } from 'hono';

import { HonoRouteBuilder } from '@/core';
import { UserController } from '../../controllers/public/user.controller';

/* ================= SETUP ================= */

const router = new Hono();

/* ================= BUILD ROUTES ================= */

const userRouter = HonoRouteBuilder.build(
  UserController,
  'web'
);

/* ================= REGISTER ================= */

// Mount controller routes
router.route('/', userRouter);

/* ================= EXPORT ================= */

export default router;
