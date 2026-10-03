import { Router } from 'express';
import { one } from '../db/pool';
import { asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
const router = Router();
router.use(requireAuth);
router.get('/status', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id = $1`, [req.user!.orgId]);
  ok(res, { bsp: { provider: org?.bsp_provider || 'direct', connected: !!org?.bsp_api_key_encrypted, status: org?.bsp_status || 'not_connected' } });
}));
router.get('/providers', asyncHandler(async (_req, res) => {
  ok(res, { providers: [{ id: '360dialog', name: '360Dialog', monthlyFee: 0, markup: '₹0.05/msg', setupTime: '1-2 days', recommended: true }] });
}));
router.post('/connect', asyncHandler(async (_req, res) => ok(res, { message: 'Add BSP_API_KEY to backend/.env' }, 400)));
router.post('/disconnect', asyncHandler(async (_req, res) => ok(res, { disconnected: true })));
export default router;
