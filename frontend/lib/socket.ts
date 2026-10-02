'use client';
import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
let socket: Socket | null = null;

export function connectSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;
  if (socket?.connected) return socket;
  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnectionAttempts: 10, reconnectionDelay: 1500 });
  socket.on('connect', () => console.log('🔌 socket connected'));
  socket.on('disconnect', () => console.log('🔌 socket disconnected'));
  return socket;
}
export function getSocket(): Socket | null { return socket; }
export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null; } }
