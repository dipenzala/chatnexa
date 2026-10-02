'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { api, setToken } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api.post('/api/v1/auth/login', { email, password });
      setToken(res.token); router.push('/dashboard');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary via-primary-700 to-mint p-12 text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center backdrop-blur"><MessageSquare className="w-5 h-5" strokeWidth={2.5} /></div>
          <span className="text-lg font-extrabold tracking-tight">ChatNexa</span>
        </Link>
        <div className="relative">
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">Welcome back to your growth engine.</h2>
          <p className="mt-4 text-white/80 max-w-md">Manage campaigns, conversations, AI replies and payments — all from one calm dashboard.</p>
        </div>
        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} ChatNexa</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-canvas">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Link href="/" className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-mint grid place-items-center"><MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} /></div>
            <span className="text-lg font-extrabold tracking-tight">ChatNexa</span>
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Sign in</h1>
          <p className="mt-2 text-slate-600 text-sm">New here? <Link href="/signup" className="font-semibold text-primary hover:underline">Create free account</Link></p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3">{error}</div>}
            <div>
              <label className="label">Work email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
