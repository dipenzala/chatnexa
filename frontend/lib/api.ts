const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const TOKEN_KEY = 'chatnexa_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) { if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY); }

async function request<T = any>(method: string, path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'include' });

  let data: any = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/login')) {
      clearToken();
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: any) => request<T>('POST', path, body),
  patch: <T = any>(path: string, body?: any) => request<T>('PATCH', path, body),
  del: <T = any>(path: string) => request<T>('DELETE', path),
};

export { API_URL };
