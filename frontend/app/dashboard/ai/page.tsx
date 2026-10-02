'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Plus, Trash2, Bot, Loader2, Send, Database, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

export default function AIStudio() {
  const { data: kb, mutate } = useSWR('/api/v1/ai/knowledge', api.get);
  const { data: usage } = useSWR('/api/v1/ai/usage', api.get);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', content: '' });
  const [testMsg, setTestMsg] = useState('');
  const [testReply, setTestReply] = useState('');
  const [testing, setTesting] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try { await api.post('/api/v1/ai/knowledge', form); setForm({ title: '', content: '' }); setShowAdd(false); mutate(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('Delete this entry?')) return;
    await api.del(`/api/v1/ai/knowledge/${id}`); mutate();
  }

  async function test(e: React.FormEvent) {
    e.preventDefault();
    if (!testMsg.trim()) return;
    setTesting(true); setTestReply('');
    try { const res = await api.post('/api/v1/ai/test-reply', { message: testMsg, history: [] }); setTestReply(res.text); }
    catch (err: any) { setTestReply(`⚠️ ${err.message}`); }
    finally { setTesting(false); }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Knowledge items', value: usage?.knowledgeItems ?? kb?.knowledge?.length ?? 0, icon: Database, color: 'text-primary', bg: 'bg-primary-50' },
          { label: 'AI messages (30d)', value: usage?.usage?.ai_messages ?? 0, icon: Bot, color: 'text-mint', bg: 'bg-mint-50' },
          { label: 'AI status', value: usage?.aiConfigured ? 'Active' : 'Off', icon: Sparkles, color: 'text-peach', bg: 'bg-peach-50' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</span>
              <div className={`w-8 h-8 rounded-lg ${s.bg} grid place-items-center`}><s.icon className={`w-4 h-4 ${s.color}`} strokeWidth={2.4} /></div>
            </div>
            <div className="mt-3 text-2xl font-extrabold tracking-tight">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="font-bold">Test your AI</h3>
        <p className="text-xs text-slate-500 mt-0.5">See how AI replies using your knowledge base (RAG).</p>
        <form onSubmit={test} className="mt-4 flex gap-2">
          <input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="What are your fees for Class 12?" className="input flex-1" />
          <button type="submit" disabled={testing} className="btn-primary px-4">{testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
        </form>
        {testReply && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-mint-50 border border-mint-100 p-4 text-sm whitespace-pre-wrap">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-mint-600 uppercase tracking-wide mb-2"><Bot className="w-3 h-3" /> AI reply preview</div>
            {testReply}
          </motion.div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">Knowledge base</h3>
            <p className="text-xs text-slate-500 mt-0.5">Your AI only answers from this content.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add entry</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {kb?.knowledge?.map((k: any) => (
            <div key={k.id} className="card p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-bold text-sm">{k.title}</h4>
                <button onClick={() => remove(k.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose hover:bg-rose-50 shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="mt-3 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-6 flex-1">{k.content}</p>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className={k.indexed ? 'badge-mint' : 'badge-slate'}>{k.indexed ? 'indexed' : 'not indexed'}</span>
              </div>
            </div>
          ))}
        </div>

        {!kb?.knowledge?.length && (
          <div className="card py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto"><Database className="w-6 h-6 text-slate-400" /></div>
            <h3 className="mt-4 font-bold">Knowledge base is empty</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">Add FAQs, pricing, policies so AI can answer accurately.</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary mt-5"><Plus className="w-4 h-4" /> Add first entry</button>
          </div>
        )}
      </div>

      {showAdd && (
        <>
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40" onClick={() => setShowAdd(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-md bg-white rounded-2xl shadow-lift p-6 max-h-[88vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-5">Add knowledge</h3>
            <form onSubmit={add} className="space-y-4">
              {error && <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3">{error}</div>}
              <div><label className="label">Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Class 12 fees" className="input" /></div>
              <div><label className="label">Content</label><textarea required rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="input resize-none text-xs" /></div>
              <button type="submit" disabled={busy} className="btn-primary w-full py-3">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save & index</button>
            </form>
          </motion.div>
        </>
      )}
    </div>
  );
}
