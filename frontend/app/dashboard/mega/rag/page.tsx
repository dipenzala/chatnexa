'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { FileText, Upload, Link as LinkIcon, Loader2, CheckCircle2, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function RagUploadPage() {
  const { data: kb, mutate } = useSWR('/api/v1/ai/knowledge', api.get);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg('');
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const res = await api.post('/api/v1/mega/rag/upload', {
        base64, filename: file.name, mime: file.type || 'application/octet-stream',
      });
      setMsg(`✅ Added ${res.chunks} chunks from ${file.name} (${res.totalWords} words)`);
      mutate();
    } catch (err: any) { setMsg(`⚠️ ${err.message}`); }
    finally { setBusy(false); e.target.value = ''; }
  }

  async function uploadUrl() {
    if (!url) return;
    setBusy(true); setMsg('');
    try {
      const res = await api.post('/api/v1/mega/rag/upload-url', { url });
      setMsg(`✅ Added ${res.chunks} chunks from URL`);
      setUrl('');
      mutate();
    } catch (err: any) { setMsg(`⚠️ ${err.message}`); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('Delete this entry?')) return;
    await api.del(`/api/v1/ai/knowledge/${id}`);
    mutate();
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href="/dashboard/mega" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Back to Features
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" /> AI Training — Documents
        </h1>
        <p className="text-sm text-slate-500 mt-1">Upload PDF, DOCX, TXT, or paste URLs — AI learns from your content</p>
      </div>

      {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.startsWith('✅') ? 'bg-mint-50 text-mint-700 border border-mint-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{msg}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="card p-6 cursor-pointer hover:border-primary/30 transition-all">
          <input type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv" onChange={uploadFile} disabled={busy} className="hidden" />
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 grid place-items-center shadow-lg mb-4">
              {busy ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Upload className="w-6 h-6 text-white" />}
            </div>
            <div className="font-bold">Upload File</div>
            <div className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT (max 10MB)</div>
          </div>
        </label>

        <div className="card p-6">
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-mint to-emerald-600 grid place-items-center shadow-lg mb-4">
              <LinkIcon className="w-6 h-6 text-white" />
            </div>
            <div className="font-bold mb-3">Paste URL</div>
            <div className="w-full flex gap-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="input text-xs" />
              <button onClick={uploadUrl} disabled={busy || !url} className="btn-primary px-4 py-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
          <div className="font-bold text-sm">Knowledge Base ({kb?.knowledge?.length || 0} entries)</div>
        </div>
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {kb?.knowledge?.map((k: any) => (
            <div key={k.id} className="px-5 py-3 flex items-center gap-3">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{k.title}</div>
                <div className="text-[11px] text-slate-500 truncate">{k.content?.slice(0, 80)}…</div>
              </div>
              <button onClick={() => remove(k.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose hover:bg-rose-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!kb?.knowledge?.length && <div className="py-10 text-center text-sm text-slate-400">No entries yet</div>}
        </div>
      </div>
    </div>
  );
}
