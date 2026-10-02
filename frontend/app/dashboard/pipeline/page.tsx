'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, Flame, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

const STAGES = [
  { id: 'new', label: 'New', color: 'from-slate-400 to-slate-500' },
  { id: 'qualified', label: 'Qualified', color: 'from-blue-500 to-indigo-600' },
  { id: 'demo_done', label: 'Demo Done', color: 'from-cyan-500 to-teal-600' },
  { id: 'proposal_sent', label: 'Proposal Sent', color: 'from-purple-500 to-violet-600' },
  { id: 'negotiating', label: 'Negotiating', color: 'from-amber-500 to-orange-600' },
  { id: 'payment_pending', label: 'Payment Pending', color: 'from-rose-500 to-pink-600' },
  { id: 'won', label: 'Won', color: 'from-mint to-emerald-600' },
];

export default function PipelinePage() {
  const { data, mutate } = useSWR<any>('/api/v1/deals/pipeline', api.get, { refreshInterval: 15000 });

  const deals = data?.deals ?? [];

  async function move(id: string, stage: string) {
    await api.patch(`/api/v1/deals/pipeline/${id}`, { pipeline_stage: stage });
    mutate();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Deal Pipeline
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Drag-free Kanban — click to move a deal forward</p>
        </div>
        <div className="text-xs text-slate-500">
          {deals.length} active deal{deals.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="overflow-x-auto pb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage, si) => {
            const stageDeals = deals.filter((d: any) => (d.pipeline_stage || 'new') === stage.id);
            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.05 }}
                className="w-[280px] shrink-0"
              >
                <div className="card p-3 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${stage.color}`} />
                    <span className="font-bold text-sm">{stage.label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                    {stageDeals.length}
                  </span>
                </div>

                <div className="space-y-2 min-h-[200px]">
                  {stageDeals.map((d: any) => (
                    <motion.div
                      key={d.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="card card-hover p-3"
                    >
                      <Link href={`/dashboard/inbox?c=${d.id}`} className="block">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-mint grid place-items-center text-white text-xs font-bold shrink-0">
                            {(d.contact_name || d.contact_phone || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{d.contact_name || d.contact_phone}</div>
                            <div className="text-[10px] text-slate-500 truncate">{d.contact_phone}</div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className={`inline-flex items-center gap-1 font-bold ${
                            d.deal_score >= 70 ? 'text-rose-600' : d.deal_score >= 40 ? 'text-peach-600' : 'text-slate-500'
                          }`}>
                            <Flame className="w-3 h-3" /> {d.deal_score || 0}
                          </span>
                          {d.pipeline_value && (
                            <span className="font-bold text-slate-700">₹{Number(d.pipeline_value).toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      </Link>
                      {si < STAGES.length - 1 && (
                        <button
                          onClick={() => move(d.id, STAGES[si + 1].id)}
                          className="mt-2 w-full text-[10px] font-bold uppercase tracking-wider rounded-lg bg-slate-100 hover:bg-primary-50 hover:text-primary-700 py-1.5 transition-colors inline-flex items-center justify-center gap-1"
                        >
                          Move to {STAGES[si + 1].label} <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                  {!stageDeals.length && (
                    <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[11px] text-slate-400">
                      Empty
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
