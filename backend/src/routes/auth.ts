import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { one, query } from '../db/pool';
import { ApiError, asyncHandler, ok } from '../lib/http';
import { signToken, requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { mailer } from '../services/mailer';

const router = Router();

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `org-${Date.now()}`;

router.post('/signup', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    password: z.string().min(8).max(72),
    orgName: z.string().min(2).max(80),
  }).parse(req.body);

  const existing = await one(`SELECT id FROM users WHERE email = $1`, [body.email.toLowerCase()]);
  if (existing) throw ApiError.conflict('An account with this email already exists');

  let slug = slugify(body.orgName);
  const taken = await one(`SELECT id FROM organizations WHERE slug = $1`, [slug]);
  if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const org = await one<any>(
    `INSERT INTO organizations (name, slug, owner_email, wallet_balance, wa_verify_token)
     VALUES ($1,$2,$3,100,$4) RETURNING *`,
    [body.orgName, slug, body.email.toLowerCase(), `${slug}-${Math.random().toString(36).slice(2, 10)}`]
  );

  const hash = await bcrypt.hash(body.password, 12);
  const user = await one<any>(
    `INSERT INTO users (org_id, email, password_hash, name, role)
     VALUES ($1,$2,$3,$4,'owner') RETURNING id, email, name, role, org_id`,
    [org.id, body.email.toLowerCase(), hash, body.name]
  );

  const token = signToken({ sub: user.id, orgId: org.id, role: user.role, email: user.email });
  mailer.sendWelcome(user.email, user.name, org.name).catch(() => {});

  ok(res, {
    token, user,
    organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, wallet_balance: Number(org.wallet_balance), wa_connected: org.wa_connected },
  }, 201);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);

  const user = await one<any>(
    `SELECT u.*, o.name AS org_name, o.slug AS org_slug FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.email = $1`,
    [email.toLowerCase()]
  );
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');
  if (!user.is_active) throw ApiError.forbidden('Account disabled');

  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

  const token = signToken({ sub: user.id, orgId: user.org_id, role: user.role, email: user.email });
  res.cookie?.('token', token, { httpOnly: true, secure: env.IS_PROD, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });

  ok(res, {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.org_id },
    organization: { id: user.org_id, name: user.org_name, slug: user.org_slug },
  });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await one<any>(
    `SELECT u.id, u.email, u.name, u.role, u.avatar_url, o.id AS org_id, o.name AS org_name, o.slug AS org_slug, o.wallet_balance, o.plan
     FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.id = $1`,
    [req.user!.id]
  );
  ok(res, { user });
}));

router.post('/logout', (_req, res) => { res.clearCookie('token'); ok(res); });

router.post('/team', requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.role !== 'owner' && req.user!.role !== 'admin') throw ApiError.forbidden();
  const { email, name, password, role } = z.object({
    email: z.string().email(), name: z.string().min(1), password: z.string().min(8),
    role: z.enum(['admin', 'agent']).default('agent'),
  }).parse(req.body);

  const exists = await one(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
  if (exists) throw ApiError.conflict('Email already in use');

  const hash = await bcrypt.hash(password, 12);
  const user = await one(
    `INSERT INTO users (org_id, email, password_hash, name, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, name, role, created_at`,
    [req.user!.orgId, email.toLowerCase(), hash, name, role]
  );
  ok(res, { user }, 201);
}));

router.get('/team', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, email, name, role, is_active, last_login_at, created_at FROM users WHERE org_id = $1 ORDER BY created_at`,
    [req.user!.orgId]
  );
  ok(res, { members: rows });
}));

router.delete('/team/:id', requireAuth, asyncHandler(async (req, res) => {
  if (req.user!.role !== 'owner') throw ApiError.forbidden();
  if (req.params.id === req.user!.id) throw ApiError.badRequest('Cannot remove yourself');
  await query(`DELETE FROM users WHERE id = $1 AND org_id = $2`, [req.params.id, req.user!.orgId]);
  ok(res);
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await one<any>(`SELECT id, name, email FROM users WHERE email = $1`, [email.toLowerCase()]);
  if (user) {
    const token = jwt.sign({ sub: user.id, type: 'reset' }, env.JWT_SECRET, { expiresIn: '30m' });
    mailer.sendPasswordReset(user.email, user.name, token).catch(() => {});
  }
  ok(res, { message: 'If the email exists, a reset link has been sent.' });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(10), password: z.string().min(8) }).parse(req.body);
  let payload: any;
  try { payload = jwt.verify(token, env.JWT_SECRET); }
  catch { throw ApiError.badRequest('Invalid or expired reset token'); }
  if (payload.type !== 'reset') throw ApiError.badRequest('Invalid reset token');

  const hash = await bcrypt.hash(password, 12);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, payload.sub]);
  ok(res, { message: 'Password updated' });
}));

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }).parse(req.body);
  const user = await one<any>(`SELECT password_hash FROM users WHERE id = $1`, [req.user!.id]);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw ApiError.unauthorized('Current password is incorrect');
  const hash = await bcrypt.hash(newPassword, 12);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user!.id]);
  ok(res, { message: 'Password changed' });
}));

export default router;
