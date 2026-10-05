import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const router = Router();

// Log every hit for debugging
router.use((req: Request, _res: Response, next) => {
  logger.info(`[WA-Setup Route] ${req.method} ${req.originalUrl}`);
  next();
});

router.use(requireAuth);

/**
 * POST /api/v1/org/whatsapp/verify-token
 */
router.post('/verify-token', asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumberId, accessToken, wabaId } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
    wabaId: z.string().optional(),
  }).parse(req.body);

  logger.info(`[WA Verify] tenant=${req.user!.orgId} phone=${phoneNumberId.slice(0, 6)}...`);

  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating,platform_type' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );

    return ok(res, {
      verified: true,
      info: {
        display_phone_number: resp.data?.display_phone_number,
        verified_name: resp.data?.verified_name,
        quality_rating: resp.data?.quality_rating,
        platform_type: resp.data?.platform_type,
      },
      wabaId: wabaId || null,
    });
  } catch (e: any) {
    const status = e.response?.status;
    const metaErr = e.response?.data?.error || {};
    let code = 'META_UNKNOWN_ERROR';
    let message = 'Could not verify with Meta.';

    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
      code = 'META_TIMEOUT';
      message = 'Meta API timeout. Please try again.';
    } else if (status === 401) {
      code = 'META_AUTH_ERROR';
      message = 'Access token is invalid or expired. Generate a new permanent token.';
    } else if (status === 403) {
      code = 'META_FORBIDDEN';
      message = 'Token does not have required WhatsApp permissions.';
    } else if (status === 404) {
      code = 'META_NOT_FOUND';
      message = 'Phone Number ID not found. Check Meta dashboard.';
    } else if (status === 400) {
      code = 'META_BAD_REQUEST';
      message = metaErr.message || 'Invalid credentials format.';
    } else if (status === 429) {
      code = 'META_RATE_LIMIT';
      message = 'Too many requests to Meta. Wait a moment.';
    } else if (metaErr.message) {
      message = metaErr.message;
    }

    logger.warn(`[WA Verify] FAILED code=${code} status=${status}`);

    return ok(res, {
      verified: false,
      error: { code, message },
      metaCode: metaErr.code,
    });
  }
}));

/**
 * POST /api/v1/org/whatsapp/connect-v2
 */
router.post('/connect-v2', asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumberId, accessToken, businessId } = z.object({
    phoneNumberId: z.string().min(3),
    accessToken: z.string().min(20),
    businessId: z.string().optional(),
  }).parse(req.body);

  const { encrypt } = await import('../lib/crypto');
  const { query } = await import('../db/pool');

  await query(
    `UPDATE organizations SET wa_phone_number_id=$2, wa_access_token=$3, wa_business_id=$4, wa_connected=TRUE WHERE id=$1`,
    [req.user!.orgId, phoneNumberId, encrypt(accessToken), businessId ?? null]
  );

  return ok(res, { connected: true, phoneNumberId, wabaId: businessId || null });
}));

/**
 * GET /api/v1/org/whatsapp/setup-status
 */
router.get('/setup-status', asyncHandler(async (req: Request, res: Response) => {
  const { one } = await import('../db/pool');
  const org = await one<any>(`SELECT * FROM organizations WHERE id=$1`, [req.user!.orgId]);
  return ok(res, {
    connected: org?.wa_connected || false,
    phoneNumberId: org?.wa_phone_number_id,
    wabaId: org?.wa_business_id,
  });
}));

/**
 * GET /api/v1/org/whatsapp/health
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, {
    ok: true,
    metaVersion: env.META_API_VERSION,
    ts: new Date().toISOString(),
  });
}));

export default router;
