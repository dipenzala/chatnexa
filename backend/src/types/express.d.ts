import 'express';
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; orgId: string; role: string; email: string };
      org?: any;
    }
  }
}
export {};
