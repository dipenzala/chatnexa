import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../lib/logger';

let io: Server | null = null;

interface AS extends Socket { userId?: string; orgId?: string }

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: [env.FRONTEND_URL, 'http://localhost:3000'], credentials: true },
    transports: ['websocket', 'polling'],
    pingTimeout: 30_000,
  });

  io.use((socket: AS, next) => {
    try {
      const token = (socket.handshake.auth?.token as string) || (socket.handshake.headers.authorization || '').replace('Bearer ', '');
      if (!token) return next(new Error('unauthorized'));
      const p = jwt.verify(token, env.JWT_SECRET) as any;
      socket.userId = p.sub; socket.orgId = p.orgId;
      next();
    } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', (socket: AS) => {
    const orgId = socket.orgId!;
    socket.join(`org:${orgId}`);
    socket.on('conversation:typing', ({ conversationId, isTyping }) => socket.to(`org:${orgId}`).emit('conversation:typing', { conversationId, isTyping, userId: socket.userId }));
    socket.on('disconnect', () => logger.debug(`socket disconnected user=${socket.userId}`));
  });

  logger.info('✅ socket.io ready');
  return io;
}

export function emitToOrg(orgId: string, event: string, payload: any) { io?.to(`org:${orgId}`).emit(event, payload); }
export function getIO() { return io; }
