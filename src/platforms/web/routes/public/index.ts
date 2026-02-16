/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Hono } from 'hono';
import userRoutes from './user.routes';

const router = new Hono();
router.route('', userRoutes);

export default router;
