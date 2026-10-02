'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

export default function SentimentPage() {
  const { data, mutate } = useSWR('/api/v1/mega/sentiment/alerts', api.get, { refreshInterval: 15000 });

  async function resolve(id: string) {
    await api.post(`/api/v1/mega/sentiment/alerts/${id}/resolve`, {});
    mutate();
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href="/dashboard/mega" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-rose-500" /> Sentiment Alerts
        </h1>
        <p className="text-sm text-slate-500 mt-1">Unhappy customers detected automatically — reach out before they churn</p>
      </div>

      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-100">
          {data?.alerts?.map((a: any) => (
            <div key={a.id} className="px-5 py-4 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full grid place-items-center text-white text-xs font-bold shrink-0 ${
                a.severity === 'high' ? 'bg-rose-500' : a.severity === 'medium' ? 'bg-orange-500' : 'bg-amber-500'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`badge ${a.severity === 'high' ? 'badge-rose' : a.severity === 'medium' ? 'badge-peach' : 'badge-blue'}`}>{a.severity}</span>
                  <span className="text-sm font-semibold">{a.contact_name || a.contact_phone}</span>
                  <span className="text-[11px] text-slate-400 ml-auto">{new Date(a.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2 bg-slate-50 rounded-lg p-2">{a.reason}</p>
                <div className="flex gap-2 mt-3">
                  <Link href={`/dashboard/inbox?c=${a.conversation_id}`} className="btn-secondary py-1.5 px-3 text-xs">
                    <ExternalLink className="w-3 h-3" /> Open Conversation
                  </Link>
                  <button onClick={() => resolve(a.id)} className="btn-mint py-1.5 px-3 text-xs">
                    <Check className="w-3 h-3" /> Mark Resolved
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!data?.alerts?.length && <div className="py-16 text-center text-sm text-slate-400">No open alerts — everything looks good! 🎉</div>}
        </div>
      </div>
    </div>
  );
}
