'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  Sparkles, TrendingUp, AlertTriangle, DollarSign, Loader2, RefreshCw,
  Flame, Users, ArrowRight, Check, X, Send, Zap, Target,
} from 'lucide-react';
import { api } from '@/lib/api';

const TABS = [
  { id: 'upsell', label: 'Upsell Engine', icon: Sparkles },
  { id: 'churn', label: 'Churn Predictor', icon: AlertTriangle },
  { id: 'forecast', label: 'Revenue Forecast', icon: DollarSign },
] as const;

export default function GrowthPage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('upsell');
  const [busy, setBusy] = useState(false);

  const { data: upsells, mutate: mutateUpsells } = useSWR('/api/v1/growth/upsell/list', api.get);
  const { data: churn } = useSWR('/api/v1/growth/churn/at-risk', api.get);
  const { data: forecast, mutate: mutateForecast } = useSWR('/api/v1/growth/forecast/latest', api.get);

  async function analyzeChurn() {
    setBusy(true);
    try {
      const res = await api.post('/api/v1/growth/churn/analyze', {});
      alert(`✅ Analyzed ${res.analyzed} contacts`);
      window.location.reload();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function generateForecast() {
    setBusy(true);
    try {
      await api.post('/api/v1/growth/forecast/generate', {});
      mutateForecast();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function acceptUpsell(id: string) {
    await api.post(`/api/v1/growth/upsell/accept/${id}`, {});
    mutateUpsells();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" /> Growth AI
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          AI-powered upsell engine, churn prediction and revenue forecasting
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-primary text-white shadow-glow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* UPSELL */}
      {tab === 'upsell' && (
        <div className="space-y-4">
          <div className="card p-5 bg-gradient-to-br from-primary-50 to-mint-50 border-primary-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-mint grid place-items-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">AI Upsell Suggestions</div>
                <div className="text-xs text-slate-600 mt-1">
                  Har contact ke liye AI suggest karta hai next best product. Accept karo aur WhatsApp pe bhejo.
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {upsells?.upsells?.map((u: any) => (
              <motion.div key={u.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-mint grid place-items-center text-white text-xs font-bold shrink-0">
                    {(u.contact_name || u.contact_phone).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{u.contact_name || u.contact_phone}</div>
                    <div className="text-[11px] text-slate-500">{u.product_name}</div>
                  </div>
                  <span className="badge-mint">{u.confidence}%</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3 mb-3">{u.message}</p>
                <div className="flex gap-2">
                  <button onClick={() => acceptUpsell(u.id)} className="btn-primary flex-1 py-2 text-xs">
                    <Check className="w-3 h-3" /> Accept
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(u.message)} className="btn-secondary flex-1 py-2 text-xs">
                    <Send className="w-3 h-3" /> Copy
                  </button>
                </div>
              </motion.div>
            ))}
            {!upsells?.upsells?.length && (
              <div className="card p-12 text-center col-span-full">
                <Sparkles className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <div className="font-bold">No upsell suggestions yet</div>
                <div className="text-sm text-slate-500 mt-1">Contact page se "Suggest Upsell" click karo</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHURN */}
      {tab === 'churn' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">High risk</div>
              <div className="mt-2 text-2xl font-extrabold text-rose-600">
                {churn?.atRisk?.filter((c: any) => c.risk_score >= 70).length ?? 0}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Medium risk</div>
              <div className="mt-2 text-2xl font-extrabold text-peach-600">
                {churn?.atRisk?.filter((c: any) => c.risk_score >= 40 && c.risk_score < 70).length ?? 0}
              </div>
            </div>
            <div className="card p-5">
              <button onClick={analyzeChurn} disabled={busy} className="btn-primary w-full h-full">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Re-analyze now
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-100">
              {churn?.atRisk?.map((c: any) => (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full grid place-items-center shrink-0 text-white text-xs font-bold ${
                    c.risk_score >= 70 ? 'bg-gradient-to-br from-rose-500 to-red-600' :
                    c.risk_score >= 40 ? 'bg-gradient-to-br from-peach to-orange-600' :
                    'bg-gradient-to-br from-yellow-500 to-amber-600'
                  }`}>
                    {c.risk_score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{c.contact_name || c.contact_phone}</div>
                    <div className="text-xs text-slate-500">{c.reason}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500 shrink-0">
                    <div>{c.days_since_last_order}d ago</div>
                  </div>
                </div>
              ))}
              {!churn?.atRisk?.length && (
                <div className="py-12 text-center text-sm text-slate-400">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Koi at-risk customer nahi. "Re-analyze" click karo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FORECAST */}
      {tab === 'forecast' && (
        <div className="space-y-4">
          <div className="card p-8 bg-gradient-to-br from-primary via-primary-700 to-mint text-white relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-5">
                <div className="text-xs font-bold uppercase tracking-wider opacity-80">Next 30 days forecast</div>
                <button onClick={generateForecast} disabled={busy} className="rounded-lg bg-white/20 backdrop-blur px-3 py-1.5 text-xs font-semibold">
                  {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <RefreshCw className="w-3 h-3 inline" />} Refresh
                </button>
              </div>
              <div className="text-5xl font-extrabold tracking-tight">
                ₹{Number(forecast?.forecast?.predicted_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-white/80">
                <span>Confidence: {forecast?.forecast?.confidence || 0}%</span>
                <span>•</span>
                <span>{forecast?.forecast?.deal_count || 0} active deals</span>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Pipeline value', value: `₹${Number(forecast?.forecast?.pipeline_value || 0).toLocaleString('en-IN')}`, icon: Target, color: 'text-primary' },
              { label: 'Deals in flight', value: forecast?.forecast?.deal_count || 0, icon: Flame, color: 'text-peach-600' },
              { label: 'Confidence', value: `${forecast?.forecast?.confidence || 0}%`, icon: TrendingUp, color: 'text-mint-600' },
            ].map((s) => (
              <div key={s.label} className="card p-5">
                <s.icon className={`w-5 h-5 ${s.color} mb-3`} />
                <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {forecast?.forecast?.notes && (
            <div className="card p-5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Analysis</div>
              <p className="text-sm text-slate-700">{forecast.forecast.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
