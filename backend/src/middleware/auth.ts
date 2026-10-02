import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../lib/http';
import { one } from '../db/pool';

export interface JwtPayload { sub: string; orgId: string; role: string; email: string }

export function signToken(p: JwtPayload) {
  return jwt.sign(p, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES as any });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : ((req as any).cookies?.token as string | undefined);
    if (!token) throw ApiError.unauthorized('Missing token');

    let payload: JwtPayload;
    try { payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload; }
    catch { throw ApiError.unauthorized('Invalid or expired token'); }

    const user = await one<any>(
      `SELECT u.id, u.org_id, u.email, u.role, u.is_active FROM users u WHERE u.id = $1`,
      [payload.sub]
    );
    if (!user || !user.is_active) throw ApiError.unauthorized('User not found or inactive');

    req.user = { id: user.id, orgId: user.org_id, role: user.role, email: user.email };
    next();
  } catch (e) { next(e); }
}

export const requireRole = (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Insufficient role'));
    next();
  };
