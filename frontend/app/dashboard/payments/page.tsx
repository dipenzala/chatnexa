'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { CreditCard, Plus, Loader2, X, Copy } from 'lucide-react';
import { api } from '@/lib/api';

export default function Payments() {
  const { data, mutate } = useSWR<any>('/api/v1/payments?limit=50', api.get);
  const { data: stats } = useSWR<any>('/api/v1/payments/stats', api.get);
  const { data: contacts } = useSWR<any>('/api/v1/contacts?limit=200', api.get);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ amount: '', description: '', contactId: '', sendWhatsApp: true });
  const [lastLink, setLastLink] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const res = await api.post('/api/v1/payments/link', {
        amount: Number(form.amount), description: form.description,
        contactId: form.contactId || undefined,
        sendWhatsApp: form.sendWhatsApp && !!form.contactId,
      });
      setLastLink(res.link);
      setForm({ amount: '', description: '', contactId: '', sendWhatsApp: true });
      mutate();
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  const statusBadge = (s: string) => ({ paid: 'badge-mint', created: 'badge-peach', failed: 'badge-rose', expired: 'badge-slate' } as any)[s] || 'badge-slate';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total links', value: stats?.stats?.total ?? 0, color: 'text-primary' },
          { label: 'Collected', value: `₹${Number(stats?.stats?.collected ?? 0).toFixed(2)}`, color: 'text-mint' },
          { label: 'Pending', value: `₹${Number(stats?.stats?.pending ?? 0).toFixed(2)}`, color: 'text-peach' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</span>
            <div className={`mt-2 text-2xl font-extrabold tracking-tight ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Payment links</h2>
          <p className="text-sm text-slate-500 mt-0.5">Collect payments on WhatsApp via Razorpay</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus className="w-4 h-4" /> New link</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/60">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Description</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Contact</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Amount</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.payments?.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3.5 font-medium">{p.description || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600">{p.contact_name || '—'}</td>
                  <td className="px-5 py-3.5 font-bold">₹{Number(p.amount).toFixed(2)}</td>
                  <td className="px-5 py-3.5"><span className={statusBadge(p.status)}>{p.status}</span></td>
                  <td className="px-5 py-3.5 text-right">
                    {p.short_url && <button onClick={() => { navigator.clipboard.writeText(p.short_url); alert('Link copied!'); }} className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-50"><Copy className="w-4 h-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data?.payments?.length && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto"><CreditCard className="w-6 h-6 text-slate-400" /></div>
            <h3 className="mt-4 font-bold">No payment links yet</h3>
            <p className="mt-1 text-sm text-slate-500">Create one and send on WhatsApp in one click.</p>
          </div>
        )}
      </div>

      {showNew && (
        <>
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40" onClick={() => setShowNew(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-md bg-white rounded-2xl shadow-lift p-6 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Create payment link</h3>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            {lastLink && (
              <div className="mb-4 rounded-xl bg-mint-50 border border-mint-100 p-3.5 text-xs break-all">
                <div className="font-bold text-mint-600 mb-1">✅ Link created</div>
                <a href={lastLink} target="_blank" rel="noreferrer" className="text-primary underline">{lastLink}</a>
              </div>
            )}
            <form onSubmit={create} className="space-y-4">
              {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3">{error}</div>}
              <div><label className="label">Amount (₹)</label><input type="number" required min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" /></div>
              <div><label className="label">Description</label><input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" /></div>
              <div>
                <label className="label">Contact (optional)</label>
                <select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })} className="input">
                  <option value="">— none —</option>
                  {contacts?.contacts?.map((c: any) => <option key={c.id} value={c.id}>{c.name || c.phone}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={form.sendWhatsApp} onChange={(e) => setForm({ ...form, sendWhatsApp: e.target.checked })} /> Send link on WhatsApp</label>
              <button type="submit" disabled={busy} className="btn-primary w-full py-3">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Create link</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
