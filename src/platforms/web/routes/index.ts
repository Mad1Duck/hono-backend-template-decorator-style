import { Hono } from 'hono';
import publicRoutes from './public';
// import privateRoutes from './private';

const router = new Hono();
router.route('', publicRoutes);
// router.route('/api', privateRoutes);

export default router;
