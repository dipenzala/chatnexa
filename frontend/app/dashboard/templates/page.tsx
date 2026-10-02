'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FileText, Trash2, X, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

export default function Templates() {
  const { data, mutate, isLoading } = useSWR('/api/v1/templates?limit=100', api.get);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'MARKETING', language: 'en', body: 'Hi {{1}}, thanks for choosing us! 🎉\n\nEnjoy 20% off.', footer: '', submitToMeta: true });

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api.post('/api/v1/templates', form);
      setShowNew(false); setForm({ ...form, name: '', body: '' }); mutate();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function sync() {
    setSyncing(true);
    try { const res = await api.post('/api/v1/org/whatsapp/sync-templates', {}); alert(`✅ Synced ${res.synced} templates from Meta`); mutate(); }
    catch (err: any) { alert(`⚠️ ${err.message}`); }
    finally { setSyncing(false); }
  }

  async function remove(id: string) {
    if (!confirm('Delete this template?')) return;
    try { await api.del(`/api/v1/templates/${id}`); mutate(); }
    catch (err: any) { alert(err.message); }
  }

  const statusBadge = (s: string) => ({ APPROVED: 'badge-mint', PENDING: 'badge-peach', REJECTED: 'badge-rose', DRAFT: 'badge-slate' } as any)[s] || 'badge-slate';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Message templates</h2>
          <p className="text-sm text-slate-500 mt-0.5">Meta-approved templates for campaigns</p>
        </div>
        <div className="flex gap-2">
          <button onClick={sync} disabled={syncing} className="btn-secondary">{syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync from Meta</button>
          <button onClick={() => setShowNew(true)} className="btn-primary"><Plus className="w-4 h-4" /> New template</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && !data && Array.from({ length: 6 }).map((_, i) => <div key={i} className="card p-5 h-44 skeleton" />)}
        {data?.templates?.map((t: any, i: number) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card p-5 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold font-mono text-sm truncate">{t.name}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={statusBadge(t.meta_status)}>{t.meta_status}</span>
                  <span className="badge-slate">{t.category}</span>
                </div>
              </div>
              <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose hover:bg-rose-50 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-700 whitespace-pre-wrap flex-1">
              {t.body}
              {t.footer && <div className="mt-2 pt-2 border-t border-slate-200 text-slate-400">{t.footer}</div>}
            </div>
          </motion.div>
        ))}
      </div>

      {!isLoading && !data?.templates?.length && (
        <div className="card py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto"><FileText className="w-6 h-6 text-slate-400" /></div>
          <h3 className="mt-4 font-bold">No templates yet</h3>
          <p className="mt-1 text-sm text-slate-500">Create one and submit to Meta for approval.</p>
          <button onClick={() => setShowNew(true)} className="btn-primary mt-5"><Plus className="w-4 h-4" /> Create template</button>
        </div>
      )}

      <AnimatePresence>
        {showNew && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNew(false)} className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-lg bg-white rounded-2xl shadow-lift p-6 max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg">New template</h3>
                <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={create} className="space-y-4">
                {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3">{error}</div>}
                <div>
                  <label className="label">Template name</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="diwali_sale_2025" className="input font-mono" />
                  <p className="mt-1.5 text-[11px] text-slate-500">Lowercase letters, numbers, underscores only.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                      <option value="MARKETING">Marketing</option><option value="UTILITY">Utility</option><option value="AUTHENTICATION">Authentication</option>
                    </select>
                  </div>
                  <div><label className="label">Language</label>
                    <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="input">
                      <option value="en">English</option><option value="hi">Hindi</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Body text</label>
                  <textarea required rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="input resize-none font-mono text-xs" />
                  <p className="mt-1.5 text-[11px] text-slate-500">Use <code className="font-mono font-bold">{'{{1}}'}</code>, <code className="font-mono font-bold">{'{{2}}'}</code> for variables.</p>
                </div>
                <div><label className="label">Footer (optional)</label><input value={form.footer} onChange={(e) => setForm({ ...form, footer: e.target.value })} maxLength={60} className="input" /></div>
                <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={form.submitToMeta} onChange={(e) => setForm({ ...form, submitToMeta: e.target.checked })} /> Submit to Meta for approval now</label>
                <button type="submit" disabled={busy} className="btn-primary w-full py-3">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Create template</button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
