'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { Zap, Plus, Trash2, ArrowLeft, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function KeywordsPage() {
  const { data, mutate } = useSWR('/api/v1/mega/keywords', api.get);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ keyword: '', match_type: 'contains', reply_text: '', priority: 0 });

  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/api/v1/mega/keywords', form);
      setForm({ keyword: '', match_type: 'contains', reply_text: '', priority: 0 });
      setShowAdd(false); mutate();
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  }

  async function toggle(id: string, is_active: boolean) {
    await api.patch(`/api/v1/mega/keywords/${id}`, { is_active: !is_active });
    mutate();
  }

  async function remove(id: string) {
    if (!confirm('Delete?')) return;
    await api.del(`/api/v1/mega/keywords/${id}`);
    mutate();
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/dashboard/mega" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" /> Keyword Auto-Reply
          </h1>
          <p className="text-sm text-slate-500 mt-1">Auto-respond when customer sends specific keywords</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add</button>
      </div>

      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-100">
          {data?.keywords?.map((k: any) => (
            <div key={k.id} className="px-5 py-4 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="badge-blue font-mono">{k.keyword}</span>
                  <span className="badge-slate text-[9px]">{k.match_type}</span>
                  {k.hits > 0 && <span className="badge-mint text-[9px]">{k.hits} hits</span>}
                </div>
                <div className="text-xs text-slate-600 mt-1.5 line-clamp-2">{k.reply_text}</div>
              </div>
              <button onClick={() => toggle(k.id, k.is_active)} className={`p-2 rounded-lg ${k.is_active ? 'text-mint-600 hover:bg-mint-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                {k.is_active ? '●' : '○'}
              </button>
              <button onClick={() => remove(k.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose hover:bg-rose-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!data?.keywords?.length && <div className="py-12 text-center text-sm text-slate-400">No keywords yet</div>}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold">Add Keyword</div>
              <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={add} className="space-y-3">
              <div><label className="label">Keyword</label><input required value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="price, fees, order" className="input" /></div>
              <div>
                <label className="label">Match Type</label>
                <select value={form.match_type} onChange={(e) => setForm({ ...form, match_type: e.target.value })} className="input">
                  <option value="contains">Contains</option>
                  <option value="exact">Exact match</option>
                  <option value="starts_with">Starts with</option>
                </select>
              </div>
              <div><label className="label">Reply Message</label><textarea required rows={4} value={form.reply_text} onChange={(e) => setForm({ ...form, reply_text: e.target.value })} className="input resize-none" /></div>
              <button type="submit" disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Add Keyword</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
