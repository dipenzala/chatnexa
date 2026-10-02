'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Upload, Trash2, Loader2, X, Users } from 'lucide-react';
import { api } from '@/lib/api';

export default function Contacts() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ phone: '', name: '', email: '', tags: '' });
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const key = `/api/v1/contacts?page=${page}&limit=25${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const { data, mutate, isLoading } = useSWR(key, api.get, { keepPreviousData: true });

  async function addContact(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api.post('/api/v1/contacts', {
        phone: form.phone, name: form.name, email: form.email || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      setForm({ phone: '', name: '', email: '', tags: '' }); setShowAdd(false); mutate();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function importCsv(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const lines = csv.trim().split('\n').filter(Boolean);
      const contacts = lines.slice(lines[0].toLowerCase().includes('phone') ? 1 : 0).map((line) => {
        const [phone, name, email] = line.split(',').map((s) => s?.trim());
        return { phone, name, email };
      }).filter((c) => c.phone);
      if (!contacts.length) throw new Error('No valid rows. Format: phone,name,email');
      const res = await api.post('/api/v1/contacts/import', { contacts });
      alert(`✅ Imported: ${res.inserted} · Updated: ${res.updated} · Skipped: ${res.skipped}`);
      setCsv(''); setShowImport(false); mutate();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('Delete this contact?')) return;
    await api.del(`/api/v1/contacts/${id}`); mutate();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" className="input pl-10" />
        </div>
        <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload className="w-4 h-4" /> Import CSV</button>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add contact</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/60">
                <th className="text-left font-semibold text-slate-500 text-xs uppercase px-5 py-3">Name</th>
                <th className="text-left font-semibold text-slate-500 text-xs uppercase px-5 py-3">Phone</th>
                <th className="text-left font-semibold text-slate-500 text-xs uppercase px-5 py-3 hidden md:table-cell">Email</th>
                <th className="text-left font-semibold text-slate-500 text-xs uppercase px-5 py-3 hidden lg:table-cell">Tags</th>
                <th className="text-left font-semibold text-slate-500 text-xs uppercase px-5 py-3 hidden sm:table-cell">Source</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && !data && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="skeleton h-4 w-full" /></td>)}</tr>
              ))}
              {data?.contacts?.map((c: any) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-mint grid place-items-center text-white text-xs font-bold shrink-0">{(c.name || c.phone).charAt(0).toUpperCase()}</div>
                      <span className="font-medium">{c.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{c.phone}</td>
                  <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{c.email || '—'}</td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).slice(0, 3).map((t: string) => <span key={t} className="badge-blue">{t}</span>)}
                      {(c.tags || []).length > 3 && <span className="badge-slate">+{c.tags.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell"><span className="badge-slate">{c.source || 'manual'}</span></td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => remove(c.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && !data?.contacts?.length && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto"><Users className="w-6 h-6 text-slate-400" /></div>
            <h3 className="mt-4 font-bold">No contacts yet</h3>
            <p className="mt-1 text-sm text-slate-500">Add a contact or import a CSV to get started.</p>
          </div>
        )}

        {data?.pagination && data.pagination.total > data.pagination.limit && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200/80">
            <span className="text-xs text-slate-500">Page {data.pagination.page} · {data.pagination.total} total</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1.5 px-3 text-xs">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * data.pagination.limit >= data.pagination.total} className="btn-secondary py-1.5 px-3 text-xs">Next</button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <Modal onClose={() => setShowAdd(false)} title="Add contact">
            <form onSubmit={addContact} className="space-y-4">
              {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3">{error}</div>}
              <div><label className="label">Phone (with country code)</label><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="919876543210" className="input" /></div>
              <div><label className="label">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rahul Sharma" className="input" /></div>
              <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></div>
              <div><label className="label">Tags (comma separated)</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, delhi" className="input" /></div>
              <button type="submit" disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Add contact</button>
            </form>
          </Modal>
        )}
        {showImport && (
          <Modal onClose={() => setShowImport(false)} title="Import from CSV">
            <form onSubmit={importCsv} className="space-y-4">
              {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3">{error}</div>}
              <div className="rounded-xl bg-primary-50 border border-primary-100 p-3.5 text-xs text-primary-700">One contact per line: <code className="font-mono font-bold">phone,name,email</code></div>
              <textarea required rows={10} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'919876543210,Rahul Sharma,rahul@example.com\n919812345678,Priya Verma,'} className="input font-mono text-xs resize-none" />
              <button type="submit" disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Import contacts</button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40" />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-md bg-white rounded-2xl shadow-lift p-6 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </motion.div>
    </>
  );
}
