import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/http';
import { logger } from '../lib/logger';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: 'Route not found' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false, error: 'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, error: err.message, details: err.details });
  }
  logger.error('unhandled', err?.stack || err?.message || err);
  res.status(500).json({ success: false, error: 'Internal server error' });
}
