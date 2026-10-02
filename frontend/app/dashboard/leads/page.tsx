'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Target, Search, TrendingUp, UserCheck, Trophy } from 'lucide-react';
import { api } from '@/lib/api';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

export default function Leads() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, mutate } = useSWR(`/api/v1/leads?limit=100${status ? `&status=${status}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`, api.get, { refreshInterval: 15000 });
  const { data: stats } = useSWR('/api/v1/leads/stats', api.get, { refreshInterval: 30000 });

  async function updateStatus(id: string, newStatus: string) { await api.patch(`/api/v1/leads/${id}`, { status: newStatus }); mutate(); }
  async function convert(id: string) {
    try { await api.post(`/api/v1/leads/${id}/convert`, {}); alert('✅ Lead converted'); mutate(); }
    catch (err: any) { alert(err.message); }
  }

  const statusColor = (s: string) => ({ new: 'badge-blue', contacted: 'badge-peach', qualified: 'badge-mint', won: 'badge-mint', lost: 'badge-rose' } as any)[s] || 'badge-slate';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total leads', value: stats?.stats?.total ?? '—', icon: Target, color: 'text-primary', bg: 'bg-primary-50' },
          { label: 'New', value: stats?.stats?.new ?? '—', icon: TrendingUp, color: 'text-peach', bg: 'bg-peach-50' },
          { label: 'Qualified', value: stats?.stats?.qualified ?? '—', icon: UserCheck, color: 'text-mint', bg: 'bg-mint-50' },
          { label: 'Won', value: stats?.stats?.won ?? '—', icon: Trophy, color: 'text-rose', bg: 'bg-rose-50' },
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads…" className="input pl-10" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input sm:w-48">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/60">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Lead</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3 hidden md:table-cell">Source</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3 hidden lg:table-cell">Score</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.leads?.map((l: any) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <div className="font-medium">{l.name || '—'}</div>
                    <div className="text-xs text-slate-500 font-mono">{l.phone}</div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell"><span className="badge-slate">{l.source}</span></td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${l.score >= 70 ? 'bg-mint' : l.score >= 40 ? 'bg-peach' : 'bg-slate-300'}`} style={{ width: `${l.score}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{l.score}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <select value={l.status} onChange={(e) => updateStatus(l.id, e.target.value)} className={`badge border-0 cursor-pointer ${statusColor(l.status)}`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {!l.contact_id && <button onClick={() => convert(l.id)} className="btn-secondary py-1.5 px-3 text-xs">Convert</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data?.leads?.length && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 grid place-items-center mx-auto"><Target className="w-6 h-6 text-slate-400" /></div>
            <h3 className="mt-4 font-bold">No leads yet</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">Connect your Meta Page in Settings → Meta Lead Ads. New leads appear here with AI scoring.</p>
          </div>
        )}
      </div>
    </div>
  );
}
