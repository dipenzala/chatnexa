import { Router, Request, Response } from 'express';
import routes from './index';

const router = Router();

router.get('/routes', (_req: Request, res: Response) => {
  const list: string[] = [];
  function walk(stack: any[], prefix: string) {
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase()).join(',');
        list.push(`${methods} ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle.stack) {
        const match = layer.regexp.source
          .replace('^\\/', '/')
          .replace('\\/?(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':id');
        walk(layer.handle.stack, prefix + match);
      }
    }
  }
  walk((routes as any).stack || [], '');
  res.json({ count: list.length, routes: list.sort() });
});

export default router;
