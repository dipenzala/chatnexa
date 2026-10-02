'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  Search, Sparkles, FileText, Hash, Megaphone, MapPin, Loader2, Copy,
  MessageSquare, Check, History, X,
} from 'lucide-react';
import { api } from '@/lib/api';

const TOOLS = [
  { id: 'bio', label: 'WhatsApp Bio', icon: MessageSquare, desc: 'AI-optimized business bio' },
  { id: 'product', label: 'Product Description', icon: FileText, desc: 'SEO e-commerce copy' },
  { id: 'hashtags', label: 'Hashtags', icon: Hash, desc: 'Viral Indian hashtags' },
  { id: 'adcopy', label: 'Ad Copy', icon: Megaphone, desc: 'FB/IG ad variations' },
  { id: 'google', label: 'Google Business', icon: MapPin, desc: 'Local SEO optimization' },
] as const;

export default function SEOPage() {
  const [tool, setTool] = useState<typeof TOOLS[number]['id']>('bio');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { data: history, mutate: mutateHistory } = useSWR('/api/v1/growth/seo/history', api.get);

  // Forms
  const [bioForm, setBioForm] = useState({ businessName: '', category: '', usp: '', city: '', phone: '' });
  const [prodForm, setProdForm] = useState({ productName: '', category: '', price: '', features: '', targetAudience: '' });
  const [hashForm, setHashForm] = useState({ topic: '', platform: 'instagram', count: 20 });
  const [adForm, setAdForm] = useState({ product: '', audience: '', goal: 'Sales', budget: '₹500/day' });
  const [gbForm, setGbForm] = useState({ businessName: '', category: '', city: '', services: '' });

  async function run() {
    setBusy(true); setResult(null);
    try {
      let res;
      if (tool === 'bio') res = await api.post('/api/v1/growth/seo/whatsapp-bio', bioForm);
      else if (tool === 'product') res = await api.post('/api/v1/growth/seo/product-description', prodForm);
      else if (tool === 'hashtags') res = await api.post('/api/v1/growth/seo/hashtags', hashForm);
      else if (tool === 'adcopy') res = await api.post('/api/v1/growth/seo/ad-copy', adForm);
      else res = await api.post('/api/v1/growth/seo/google-business', gbForm);
      setResult(res);
      mutateHistory();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" /> SEO Tools
        </h1>
        <p className="text-sm text-slate-500 mt-1">AI-powered content for WhatsApp, Google and social media</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTool(t.id); setResult(null); }}
            className={`card p-4 text-left transition-all hover:shadow-lift ${
              tool === t.id ? 'ring-2 ring-primary shadow-lift' : ''
            }`}
          >
            <t.icon className={`w-5 h-5 mb-2 ${tool === t.id ? 'text-primary' : 'text-slate-400'}`} />
            <div className="font-bold text-sm">{t.label}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* INPUT FORM */}
        <div className="card p-6 space-y-4">
          <div className="font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> {TOOLS.find((t) => t.id === tool)?.label}
          </div>

          {tool === 'bio' && (
            <>
              <div><label className="label">Business Name</label><input value={bioForm.businessName} onChange={(e) => setBioForm({ ...bioForm, businessName: e.target.value })} className="input" placeholder="Sharma Coaching Classes" /></div>
              <div><label className="label">Category</label><input value={bioForm.category} onChange={(e) => setBioForm({ ...bioForm, category: e.target.value })} className="input" placeholder="Coaching / Education" /></div>
              <div><label className="label">Unique Selling Point</label><input value={bioForm.usp} onChange={(e) => setBioForm({ ...bioForm, usp: e.target.value })} className="input" placeholder="10+ years experience, 500+ students" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">City</label><input value={bioForm.city} onChange={(e) => setBioForm({ ...bioForm, city: e.target.value })} className="input" placeholder="Delhi" /></div>
                <div><label className="label">Phone</label><input value={bioForm.phone} onChange={(e) => setBioForm({ ...bioForm, phone: e.target.value })} className="input" placeholder="9876543210" /></div>
              </div>
            </>
          )}

          {tool === 'product' && (
            <>
              <div><label className="label">Product Name</label><input value={prodForm.productName} onChange={(e) => setProdForm({ ...prodForm, productName: e.target.value })} className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Category</label><input value={prodForm.category} onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })} className="input" /></div>
                <div><label className="label">Price</label><input value={prodForm.price} onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })} className="input" /></div>
              </div>
              <div><label className="label">Features</label><textarea rows={3} value={prodForm.features} onChange={(e) => setProdForm({ ...prodForm, features: e.target.value })} className="input resize-none" /></div>
              <div><label className="label">Target Audience</label><input value={prodForm.targetAudience} onChange={(e) => setProdForm({ ...prodForm, targetAudience: e.target.value })} className="input" /></div>
            </>
          )}

          {tool === 'hashtags' && (
            <>
              <div><label className="label">Topic</label><input value={hashForm.topic} onChange={(e) => setHashForm({ ...hashForm, topic: e.target.value })} className="input" placeholder="Diwali sale, yoga, cafe Delhi" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Platform</label>
                  <select value={hashForm.platform} onChange={(e) => setHashForm({ ...hashForm, platform: e.target.value })} className="input">
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">Twitter/X</option>
                  </select>
                </div>
                <div><label className="label">Count</label><input type="number" min={5} max={50} value={hashForm.count} onChange={(e) => setHashForm({ ...hashForm, count: Number(e.target.value) })} className="input" /></div>
              </div>
            </>
          )}

          {tool === 'adcopy' && (
            <>
              <div><label className="label">Product/Service</label><input value={adForm.product} onChange={(e) => setAdForm({ ...adForm, product: e.target.value })} className="input" /></div>
              <div><label className="label">Target Audience</label><input value={adForm.audience} onChange={(e) => setAdForm({ ...adForm, audience: e.target.value })} className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Goal</label><input value={adForm.goal} onChange={(e) => setAdForm({ ...adForm, goal: e.target.value })} className="input" /></div>
                <div><label className="label">Budget</label><input value={adForm.budget} onChange={(e) => setAdForm({ ...adForm, budget: e.target.value })} className="input" /></div>
              </div>
            </>
          )}

          {tool === 'google' && (
            <>
              <div><label className="label">Business Name</label><input value={gbForm.businessName} onChange={(e) => setGbForm({ ...gbForm, businessName: e.target.value })} className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Category</label><input value={gbForm.category} onChange={(e) => setGbForm({ ...gbForm, category: e.target.value })} className="input" /></div>
                <div><label className="label">City</label><input value={gbForm.city} onChange={(e) => setGbForm({ ...gbForm, city: e.target.value })} className="input" /></div>
              </div>
              <div><label className="label">Services</label><textarea rows={3} value={gbForm.services} onChange={(e) => setGbForm({ ...gbForm, services: e.target.value })} className="input resize-none" placeholder="Maths, Science, English tutoring..." /></div>
            </>
          )}

          <button onClick={run} disabled={busy} className="btn-primary w-full py-3">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Generating…' : 'Generate with AI'}
          </button>
        </div>

        {/* RESULT */}
        <div className="card p-6">
          <div className="font-bold mb-4 flex items-center gap-2">
            <Check className="w-4 h-4 text-mint" /> Generated Output
          </div>

          {!result && !busy && (
            <div className="py-12 text-center text-slate-400">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Fill the form and generate</p>
            </div>
          )}

          {busy && (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
              <p className="text-sm text-slate-500 mt-3">AI is thinking…</p>
            </div>
          )}

          {result && !busy && (
            <div className="space-y-3">
              {result.bios && result.bios.map((b: string, i: number) => (
                <div key={i} className="rounded-xl bg-slate-50 p-4 relative group">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Variation {i + 1}</div>
                  <div className="text-sm text-slate-700 pr-8">{b}</div>
                  <button onClick={() => navigator.clipboard.writeText(b)} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {result.short && (
                <>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Short Description</div>
                    <p className="text-sm text-slate-700">{result.short}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Long Description</div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{result.long}</p>
                  </div>
                  {result.keywords && (
                    <div className="rounded-xl bg-primary-50 p-4">
                      <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Keywords</div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.keywords.map((k: string, i: number) => <span key={i} className="badge-blue">{k}</span>)}
                      </div>
                    </div>
                  )}
                </>
              )}

              {result.hashtags && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Hashtags</div>
                  <div className="text-sm text-primary break-words">{result.hashtags.join(' ')}</div>
                  <button onClick={() => navigator.clipboard.writeText(result.hashtags.join(' '))} className="mt-3 btn-secondary py-1.5 px-3 text-xs">
                    <Copy className="w-3 h-3" /> Copy All
                  </button>
                </div>
              )}

              {result.variations && result.variations.map((v: any, i: number) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <span className={`badge ${
                    v.angle === 'emotional' ? 'badge-rose' :
                    v.angle === 'urgency' ? 'badge-peach' : 'badge-blue'
                  }`}>{v.angle}</span>
                  <div className="mt-2 font-bold text-sm">{v.headline}</div>
                  <p className="text-xs text-slate-600 mt-1">{v.primary_text}</p>
                  <div className="text-[11px] text-slate-400 mt-2">CTA: {v.cta}</div>
                </div>
              ))}

              {result.description && (
                <>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</div>
                    <p className="text-sm text-slate-700">{result.description}</p>
                  </div>
                  {result.categories && (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Categories</div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.categories.map((c: string, i: number) => <span key={i} className="badge-blue">{c}</span>)}
                      </div>
                    </div>
                  )}
                  {result.service_keywords && (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Service Keywords</div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.service_keywords.map((k: string, i: number) => <span key={i} className="badge-mint">{k}</span>)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* HISTORY */}
      {history?.history?.length > 0 && (
        <div className="card p-5">
          <div className="font-bold mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" /> Recent Generations
          </div>
          <div className="space-y-2">
            {history.history.slice(0, 5).map((h: any) => (
              <div key={h.id} className="flex items-center gap-3 text-xs py-2 border-b border-slate-100 last:border-0">
                <span className="badge-slate">{h.content_type}</span>
                <span className="text-slate-600 truncate flex-1">{h.prompt}</span>
                <span className="text-slate-400 shrink-0">
                  {new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
