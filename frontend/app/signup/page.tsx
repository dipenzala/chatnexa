'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageSquare, Loader2, ArrowRight, Check } from 'lucide-react';
import { api, setToken } from '@/lib/api';

export default function Signup() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      const res = await api.post('/api/v1/auth/signup', form);
      setToken(res.token); router.push('/dashboard');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-mint via-primary to-primary-800 p-12 text-white relative overflow-hidden">
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-peach/20 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center backdrop-blur"><MessageSquare className="w-5 h-5" strokeWidth={2.5} /></div>
          <span className="text-lg font-extrabold tracking-tight">ChatNexa</span>
        </Link>
        <div className="relative">
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">Start selling on WhatsApp today.</h2>
          <ul className="mt-8 space-y-3">
            {['No credit card required', '₹100 free wallet credit', 'Official Meta WhatsApp API', 'AI auto-reply included'].map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-white/90">
                <span className="w-5 h-5 rounded-full bg-white/20 grid place-items-center shrink-0"><Check className="w-3 h-3" strokeWidth={3} /></span>{p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Trusted by 10,000+ Indian SMBs</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-canvas overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md py-8">
          <Link href="/" className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-mint grid place-items-center"><MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} /></div>
            <span className="text-lg font-extrabold tracking-tight">ChatNexa</span>
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Create your workspace</h1>
          <p className="mt-2 text-slate-600 text-sm">Already have one? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3">{error}</div>}
            <div><label className="label">Your name</label><input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Rahul Sharma" className="input" /></div>
            <div><label className="label">Business name</label><input required value={form.orgName} onChange={(e) => set('orgName', e.target.value)} placeholder="Sharma Coaching Classes" className="input" /></div>
            <div><label className="label">Work email</label><input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@company.com" className="input" /></div>
            <div><label className="label">Password</label><input type="password" required minLength={8} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 8 characters" className="input" /></div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Creating workspace…' : 'Create free account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
