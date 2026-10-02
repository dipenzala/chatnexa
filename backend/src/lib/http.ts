import { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  status: number; details?: any;
  constructor(s: number, m: string, d?: any) { super(m); this.status = s; this.details = d; }
  static badRequest(m = 'Bad request', d?: any) { return new ApiError(400, m, d); }
  static unauthorized(m = 'Unauthorized') { return new ApiError(401, m); }
  static forbidden(m = 'Forbidden') { return new ApiError(403, m); }
  static notFound(m = 'Not found') { return new ApiError(404, m); }
  static conflict(m = 'Conflict') { return new ApiError(409, m); }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

export const ok = (res: Response, data: any = {}, status = 200) => res.status(status).json({ success: true, ...data });

export const pageParams = (req: Request) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
};
