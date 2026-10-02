'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Pause, X, Loader2, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';

export default function Campaigns() {
  const { data, mutate, isLoading } = useSWR<any>('/api/v1/campaigns?limit=50', api.get, { refreshInterval: 8000 });
  const { data: templates } = useSWR<any>('/api/v1/templates?limit=100', api.get);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', templateId: '', tags: '', sendNow: true, scheduledAt: '' });

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const audience = form.tags ? { tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) } : { all: true };
      await api.post('/api/v1/campaigns', {
        name: form.name, templateId: form.templateId, audience,
        sendNow: form.sendNow && !form.scheduledAt,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        variables: {},
      });
      setForm({ name: '', templateId: '', tags: '', sendNow: true, scheduledAt: '' }); setShowNew(false); mutate();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function action(id: string, act: string) {
    try { await api.post(`/api/v1/campaigns/${id}/${act}`, {}); mutate(); }
    catch (err: any) { alert(err.message); }
  }

  const statusBadge = (s: string) => ({ running: 'badge-mint', completed: 'badge-blue', paused: 'badge-peach', failed: 'badge-rose', draft: 'badge-slate', scheduled: 'badge-blue' } as any)[s] || 'badge-slate';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Campaigns</h2>
          <p className="text-sm text-slate-500 mt-0.5">Broadcast WhatsApp template messages at scale</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus className="w-4 h-4" /> New campaign</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && !data && Array.from({ length: 6 }).map((_, i) => <div key={i} className="card p-5 h-40 skeleton" />)}
        {data?.campaigns?.map((c: any, i: number) => {
          const readRate = c.sent > 0 ? ((c.read_count / c.sent) * 100).toFixed(0) : '0';
          const progress = c.total > 0 ? Math.min(100, ((c.sent + c.failed) / c.total) * 100) : 0;
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold truncate">{c.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate font-mono">{c.template_name}</p>
                </div>
                <span className={statusBadge(c.status)}>{c.status}</span>
              </div>

              {c.status === 'running' && (
                <div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                  <p className="text-[11px] text-slate-500 mt-1.5">{progress.toFixed(0)}% processed</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 py-2.5"><div className="text-base font-extrabold">{c.total}</div><div className="text-[10px] text-slate-500 font-semibold uppercase">Total</div></div>
                <div className="rounded-xl bg-primary-50 py-2.5"><div className="text-base font-extrabold text-primary-700">{c.sent}</div><div className="text-[10px] text-primary-600 font-semibold uppercase">Sent</div></div>
                <div className="rounded-xl bg-mint-50 py-2.5"><div className="text-base font-extrabold text-mint-600">{readRate}%</div><div className="text-[10px] text-mint-600 font-semibold uppercase">Read</div></div>
              </div>

              <div className="flex gap-2 pt-1">
                {c.status === 'draft' && <button onClick={() => action(c.id, 'start')} className="btn-primary flex-1 py-2 text-xs"><Play className="w-3.5 h-3.5" /> Start</button>}
                {c.status === 'running' && <button onClick={() => action(c.id, 'pause')} className="btn-secondary flex-1 py-2 text-xs"><Pause className="w-3.5 h-3.5" /> Pause</button>}
                {c.status === 'paused' && <button onClick={() => action(c.id, 'resume')} className="btn-mint flex-1 py-2 text-xs"><Play className="w-3.5 h-3.5" /> Resume</button>}
                {c.status === 'scheduled' && <button onClick={() => action(c.id, 'cancel')} className="btn-danger flex-1 py-2 text-xs"><X className="w-3.5 h-3.5" /> Cancel</button>}
              </div>
            </motion.div>
          );
        })}
      </div>

      {!isLoading && !data?.campaigns?.length && (
        <div className="card py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto"><Megaphone className="w-6 h-6 text-slate-400" /></div>
          <h3 className="mt-4 font-bold">No campaigns yet</h3>
          <p className="mt-1 text-sm text-slate-500">Create your first broadcast campaign.</p>
          <button onClick={() => setShowNew(true)} className="btn-primary mt-5"><Plus className="w-4 h-4" /> Create campaign</button>
        </div>
      )}

      <AnimatePresence>
        {showNew && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNew(false)} className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-md bg-white rounded-2xl shadow-lift p-6 max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg">New campaign</h3>
                <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={create} className="space-y-4">
                {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3">{error}</div>}
                <div><label className="label">Campaign name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Diwali Sale 2025" className="input" /></div>
                <div>
                  <label className="label">Template</label>
                  <select required value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })} className="input">
                    <option value="">Select an approved template…</option>
                    {templates?.templates?.map((t: any) => <option key={t.id} value={t.id}>{t.name} · {t.category} · {t.meta_status}</option>)}
                  </select>
                  {!templates?.templates?.length && <p className="mt-1.5 text-[11px] text-peach font-medium">No templates yet. Create one in Templates page first.</p>}
                </div>
                <div><label className="label">Audience tags (optional)</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, delhi — leave blank for everyone" className="input" /></div>
                <div><label className="label">Schedule (optional)</label><input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="input" /></div>
                <button type="submit" disabled={busy} className="btn-primary w-full py-3">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {form.scheduledAt ? 'Schedule campaign' : 'Launch campaign'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
