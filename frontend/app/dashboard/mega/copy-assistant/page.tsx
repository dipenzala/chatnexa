'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Languages, ArrowLeft, Loader2, Copy, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

export default function CopyAssistantPage() {
  const [text, setText] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'urgent' | 'casual'>('friendly');
  const [lang, setLang] = useState<'hinglish' | 'hindi' | 'english'>('hinglish');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function rewrite() {
    if (!text) return;
    setBusy(true); setResult(null);
    try {
      const res = await api.post('/api/v1/mega/copy/rewrite', { text, tone, language: lang });
      setResult(res);
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href="/dashboard/mega" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Languages className="w-6 h-6 text-violet-500" /> Copy Assistant
        </h1>
        <p className="text-sm text-slate-500 mt-1">Rewrite messages in Hinglish with perfect tone</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="card p-5 space-y-3">
          <div><label className="label">Your message</label><textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your draft message…" className="input resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value as any)} className="input">
                <option value="friendly">Friendly</option><option value="professional">Professional</option>
                <option value="urgent">Urgent</option><option value="casual">Casual</option>
              </select>
            </div>
            <div>
              <label className="label">Language</label>
              <select value={lang} onChange={(e) => setLang(e.target.value as any)} className="input">
                <option value="hinglish">Hinglish</option><option value="hindi">Hindi</option><option value="english">English</option>
              </select>
            </div>
          </div>
          <button onClick={rewrite} disabled={busy || !text} className="btn-primary w-full">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Rewrite with AI
          </button>
        </div>
        <div className="card p-5">
          {result ? (
            <>
              <div className="font-bold text-sm mb-3">Rewritten</div>
              <div className="rounded-xl bg-mint-50 border border-mint-100 p-4 mb-3">
                <p className="text-sm">{result.rewritten}</p>
                <button onClick={() => navigator.clipboard.writeText(result.rewritten)} className="mt-2 text-xs text-mint-700 font-semibold inline-flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
              </div>
              {result.variations?.length > 0 && (
                <>
                  <div className="font-bold text-sm mb-2 mt-4">Variations</div>
                  {result.variations.map((v: string, i: number) => (
                    <div key={i} className="rounded-xl bg-slate-50 p-3 mb-2 text-xs">{v}</div>
                  ))}
                </>
              )}
            </>
          ) : (
            <div className="text-center text-slate-400 text-sm py-12">Output appears here</div>
          )}
        </div>
      </div>
    </div>
  );
}
