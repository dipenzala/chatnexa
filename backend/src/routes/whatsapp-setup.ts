import { Router } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { encrypt } from '../lib/crypto';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/v1/org/whatsapp/verify-token
 * Verifies Meta WhatsApp Cloud API credentials without storing them
 */
router.post('/verify-token', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, wabaId } = z.object({
    phoneNumberId: z.string().min(3).regex(/^\d+$/, 'Phone Number ID must be numeric'),
    accessToken: z.string().min(20),
    wabaId: z.string().optional(),
  }).parse(req.body);

  // Safe logging (never log the token)
  logger.info(`[WA Verify] tenant=${req.user!.orgId} phoneNumberId=${phoneNumberId.slice(0, 6)}...`);

  try {
    const url = `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`;
    const resp = await axios.get(url, {
      params: { fields: 'display_phone_number,verified_name,quality_rating,platform_type,account_mode' },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });

    const data = resp.data || {};

    // Try to auto-detect WABA ID from phone number's associated WABA
    let detectedWabaId: string | null = null;
    if (!wabaId) {
      try {
        // Try the phone_numbers endpoint to find WABA
        const wabaResp = await axios.get(
          `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}?fields=id,display_phone_number`,
          { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
        );
        detectedWabaId = wabaResp.data?.id || null;
      } catch {
        // WABA detection failed — not critical
      }
    }

    return ok(res, {
      verified: true,
      info: {
        display_phone_number: data.display_phone_number,
        verified_name: data.verified_name,
        quality_rating: data.quality_rating,
        platform_type: data.platform_type,
        account_mode: data.account_mode,
      },
      wabaId: wabaId || detectedWabaId,
      autoDetected: !wabaId && !!detectedWabaId,
    });
  } catch (e: any) {
    const metaError = e.response?.data?.error || {};
    const status = e.response?.status;

    // Differentiate error types
    let code = 'META_UNKNOWN_ERROR';
    let message = 'Could not verify credentials with Meta.';

    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
      code = 'META_TIMEOUT';
      message = 'Meta API is not responding. Please try again.';
    } else if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') {
      code = 'META_UNREACHABLE';
      message = 'Cannot reach Meta API. Check your internet connection.';
    } else if (status === 401) {
      code = 'META_AUTH_ERROR';
      message = 'Access token is invalid or expired. Generate a new permanent token.';
    } else if (status === 403) {
      code = 'META_FORBIDDEN';
      message = 'Token does not have the required permissions for WhatsApp Business API.';
    } else if (status === 404) {
      code = 'META_NOT_FOUND';
      message = 'Phone Number ID not found. Verify it from Meta App Dashboard → WhatsApp → API Setup.';
    } else if (status === 400) {
      code = 'META_BAD_REQUEST';
      message = metaError.message || 'Invalid Phone Number ID or request format.';
    } else if (status === 429) {
      code = 'META_RATE_LIMIT';
      message = 'Too many requests to Meta. Please wait a moment and try again.';
    } else if (status >= 500) {
      code = 'META_SERVER_ERROR';
      message = 'Meta API is having issues. Please try again later.';
    } else if (metaError.message) {
      message = metaError.message;
    }

    logger.warn(`[WA Verify] failed tenant=${req.user!.orgId} code=${code} status=${status} msg=${message}`);

    return ok(res, {
      verified: false,
      error: { code, message },
      // Include Meta's error code for debugging (safe — not the token)
      metaCode: metaError.code,
      metaType: metaError.type,
    });
  }
}));

/**
 * POST /api/v1/org/whatsapp/connect-v2
 * Stores credentials securely after verification
 */
router.post('/connect-v2', asyncHandler(async (req, res) => {
  const { phoneNumberId, accessToken, businessId } = z.object({
    phoneNumberId: z.string().min(3).regex(/^\d+$/),
    accessToken: z.string().min(20),
    businessId: z.string().optional(),
  }).parse(req.body);

  // Re-verify before storing
  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${env.META_API_VERSION}/${phoneNumberId}`,
      {
        params: { fields: 'display_phone_number,verified_name,quality_rating' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }
    );

    await query(
      `UPDATE organizations SET
         wa_phone_number_id = $2,
         wa_access_token = $3,
         wa_business_id = $4,
         wa_connected = TRUE
       WHERE id = $1`,
      [req.user!.orgId, phoneNumberId, encrypt(accessToken), businessId ?? null]
    );

    return ok(res, {
      connected: true,
      phoneNumberId,
      wabaId: businessId || null,
      info: {
        display_phone_number: resp.data?.display_phone_number,
        verified_name: resp.data?.verified_name,
        quality_rating: resp.data?.quality_rating,
      },
    });
  } catch (e: any) {
    const metaError = e.response?.data?.error || {};
    throw ApiError.badRequest(metaError.message || 'Could not verify credentials with Meta.');
  }
}));

/**
 * GET /api/v1/org/whatsapp/setup-status
 */
router.get('/setup-status', asyncHandler(async (req, res) => {
  const org = await one<any>(`SELECT * FROM organizations WHERE id = $1`, [req.user!.orgId]);
  if (!org) throw ApiError.notFound();

  return ok(res, {
    connected: org.wa_connected || false,
    hasCredentials: !!(org.wa_phone_number_id && org.wa_access_token),
    hasWabaId: !!org.wa_business_id,
    phoneNumberId: org.wa_phone_number_id,
    wabaId: org.wa_business_id,
    webhookUrl: `${env.FRONTEND_URL.replace(':3000', ':8080')}/api/v1/webhooks/whatsapp`,
    verifyToken: env.META_VERIFY_TOKEN,
  });
}));

/**
 * GET /api/v1/org/whatsapp/health
 */
router.get('/health', asyncHandler(async (_req, res) => {
  return ok(res, {
    ok: true,
    metaApiVersion: env.META_API_VERSION,
    metaGraphUrl: env.META_GRAPH_URL,
    hasVerifyToken: !!env.META_VERIFY_TOKEN,
    ts: new Date().toISOString(),
  });
}));

export default router;
