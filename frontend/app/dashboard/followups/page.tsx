'use client';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Clock, Power, Trash2, Zap } from 'lucide-react';
import { api } from '@/lib/api';

export default function FollowupsPage() {
  const { data: seqs, mutate } = useSWR<any>('/api/v1/followups/sequences', api.get);
  const { data: queue } = useSWR<any>('/api/v1/followups/queue', api.get, { refreshInterval: 20000 });

  async function toggle(id: string) {
    await api.post(`/api/v1/followups/sequences/${id}/toggle`, {});
    mutate();
  }
  async function remove(id: string) {
    if (!confirm('Delete this sequence?')) return;
    await api.del(`/api/v1/followups/sequences/${id}`);
    mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Follow-up Sequences
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">AI auto-nudges silent customers. Recover leads on autopilot.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-bold mb-4">Your sequences</h3>
          <div className="space-y-3">
            {seqs?.sequences?.map((s: any) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-slate-200/80 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{s.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Trigger: {s.trigger_stage} · {(s.steps as any[]).length} step{(s.steps as any[]).length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggle(s.id)}
                      className={`p-1.5 rounded-lg transition-colors ${s.is_active ? 'text-mint-600 hover:bg-mint-50' : 'text-slate-400 hover:bg-slate-100'}`}
                      title={s.is_active ? 'Disable' : 'Enable'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(s.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose hover:bg-rose-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {(s.steps as any[]).map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                      <span className="shrink-0 min-w-[50px] font-mono text-slate-400">+{step.delay_hours}h</span>
                      <span className="line-clamp-2">{step.prompt}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <span className={s.is_active ? 'badge-mint' : 'badge-slate'}>{s.is_active ? 'active' : 'paused'}</span>
                </div>
              </motion.div>
            ))}
            {!seqs?.sequences?.length && (
              <p className="text-sm text-slate-400 py-6 text-center">No sequences yet</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-peach" /> Queue
            {queue?.queue?.length > 0 && (
              <span className="badge-blue ml-auto">{queue.queue.length}</span>
            )}
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {queue?.queue?.map((q: any) => (
              <div key={q.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 grid place-items-center text-white text-[11px] font-bold shrink-0">
                  {(q.contact_name || q.contact_phone || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{q.contact_name || q.contact_phone}</div>
                  <div className="text-[10px] text-slate-500">
                    Step {q.step_index + 1} · <span className={q.status === 'sent' ? 'text-mint-600' : 'text-peach-600'}>{q.status}</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 text-right shrink-0">
                  {new Date(q.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            ))}
            {!queue?.queue?.length && (
              <p className="text-sm text-slate-400 py-6 text-center">Queue is empty</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
