'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, MessageSquare, Megaphone, Target, TrendingUp, Wallet, ArrowRight, Flame, Clock, Plus, Sparkles, Send, UserPlus, Zap, Bot, BarChart3, Brain } from 'lucide-react';
import { api } from '@/lib/api';

export default function DashboardHome() {
  const { data: me } = useSWR<any>('/api/v1/auth/me', api.get);
  const { data: overview, isLoading } = useSWR<any>('/api/v1/analytics/overview', api.get, { refreshInterval: 20000 });
  const { data: hot } = useSWR<any>('/api/v1/deals/hot', api.get, { refreshInterval: 20000 });
  const { data: followups } = useSWR<any>('/api/v1/followups/queue', api.get, { refreshInterval: 30000 });

  const firstName = (me?.user?.name || '').split(' ')[0] || 'there';

  const kpis = [
    { label: 'Contacts', value: overview?.contacts?.total ?? 0, sub: `+${overview?.contacts?.new_30d ?? 0} this month`, icon: Users, color: 'from-blue-500 to-indigo-600', href: '/dashboard/contacts' },
    { label: 'Messages', value: overview?.messages?.total ?? 0, sub: `${overview?.messages?.outbound ?? 0} sent`, icon: MessageSquare, color: 'from-teal-500 to-emerald-600', href: '/dashboard/inbox' },
    { label: 'Campaigns', value: overview?.campaigns?.total ?? 0, sub: `${overview?.campaigns?.running ?? 0} running`, icon: Megaphone, color: 'from-orange-500 to-red-500', href: '/dashboard/campaigns' },
    { label: 'Leads', value: overview?.leads?.total ?? 0, sub: `${overview?.leads?.new ?? 0} new`, icon: Target, color: 'from-rose-500 to-pink-600', href: '/dashboard/leads' },
  ];

  const quickActions = [
    { href: '/dashboard/campaigns', label: 'New Campaign', desc: 'Broadcast to your audience', icon: Send, color: 'from-orange-500 to-red-500' },
    { href: '/dashboard/contacts', label: 'Add Contact', desc: 'Single or CSV import', icon: UserPlus, color: 'from-blue-500 to-indigo-600' },
    { href: '/dashboard/ai', label: 'Train AI', desc: 'Add FAQs & policies', icon: Bot, color: 'from-teal-500 to-emerald-600' },
    { href: '/dashboard/payments', label: 'Payment Link', desc: 'Collect on WhatsApp', icon: Zap, color: 'from-purple-500 to-violet-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-700 to-mint p-6 sm:p-8 text-white shadow-lift"
      >
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-peach/25 blur-3xl"
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
              <Sparkles className="w-3 h-3" /> Welcome back
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Namaste, {firstName} 👋
            </h2>
            <p className="mt-1.5 text-sm text-white/85 max-w-xl">
              Here's your business at a glance. Ready to close some deals?
            </p>
          </div>
          <Link
            href="/dashboard/inbox"
            className="inline-flex items-center gap-2 rounded-xl bg-white text-primary px-5 py-3 font-bold shadow-lg hover:-translate-y-0.5 transition-all shrink-0"
          >
            <MessageSquare className="w-4 h-4" /> Open Inbox
          </Link>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Link href={k.href} className="block card card-hover p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${k.color} grid place-items-center shadow-md`}>
                  <k.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.4} />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </div>
              <div className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight">
                {isLoading ? <div className="skeleton h-6 w-12" /> : k.value}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{k.sub}</div>
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">{k.label}</div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Quick actions
        </h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a, i) => (
            <motion.div
              key={a.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
            >
              <Link href={a.href} className="block card card-hover p-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${a.color} grid place-items-center shadow-md`}>
                  <a.icon className="w-5 h-5 text-white" strokeWidth={2.3} />
                </div>
                <div className="mt-3 font-bold text-sm">{a.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{a.desc}</div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Hot Leads + Follow-ups */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hot Leads */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 grid place-items-center">
                <Flame className="w-4 h-4 text-white" strokeWidth={2.4} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Hot Leads</h3>
                <p className="text-[11px] text-slate-500">Score 60+ · ready to buy</p>
              </div>
            </div>
            <Link href="/dashboard/pipeline" className="text-xs font-semibold text-primary hover:underline">
              View all →
            </Link>
          </div>

          <div className="space-y-2">
            {hot?.hot?.slice(0, 5).map((h: any) => (
              <Link
                key={h.id}
                href={`/dashboard/inbox?c=${h.id}`}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-mint grid place-items-center text-white text-xs font-bold shrink-0">
                  {(h.contact_name || h.contact_phone || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{h.contact_name || h.contact_phone}</div>
                  <div className="text-[11px] text-slate-500 truncate">{h.deal_reason || h.last_message || 'Active conversation'}</div>
                </div>
                <div className={`shrink-0 min-w-[44px] text-center rounded-lg px-2 py-1 text-xs font-extrabold ${
                  h.deal_score >= 80 ? 'bg-rose-50 text-rose-600' :
                  h.deal_score >= 70 ? 'bg-peach-50 text-peach-600' :
                  'bg-mint-50 text-mint-600'
                }`}>
                  🔥 {h.deal_score}
                </div>
              </Link>
            ))}
            {!hot?.hot?.length && (
              <div className="py-8 text-center">
                <Flame className="w-8 h-8 mx-auto text-slate-200" />
                <p className="mt-2 text-xs text-slate-400">No hot leads yet. AI will score conversations automatically.</p>
              </div>
            )}
          </div>
        </div>

        {/* Follow-ups */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 grid place-items-center">
                <Clock className="w-4 h-4 text-white" strokeWidth={2.4} />
              </div>
              <div>
                <h3 className="font-bold text-sm">Upcoming Follow-ups</h3>
                <p className="text-[11px] text-slate-500">Auto-nudge queue</p>
              </div>
            </div>
            <Link href="/dashboard/followups" className="text-xs font-semibold text-primary hover:underline">
              Manage →
            </Link>
          </div>

          <div className="space-y-2">
            {followups?.queue?.slice(0, 5).map((f: any) => (
              <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 grid place-items-center text-white text-xs font-bold shrink-0">
                  {(f.contact_name || f.contact_phone || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{f.contact_name || f.contact_phone}</div>
                  <div className="text-[11px] text-slate-500">
                    Step {f.step_index + 1} · {f.status}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 shrink-0 text-right">
                  {new Date(f.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  <br />
                  {new Date(f.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {!followups?.queue?.length && (
              <div className="py-8 text-center">
                <Clock className="w-8 h-8 mx-auto text-slate-200" />
                <p className="mt-2 text-xs text-slate-400">No follow-ups scheduled. AI will queue them automatically.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: '/dashboard/campaigns', title: 'Launch a campaign', desc: 'Send a template to your audience', icon: Megaphone, color: 'from-orange-500 to-red-500' },
          { href: '/dashboard/ai', title: 'Train your AI', desc: 'Add FAQs to knowledge base', icon: Brain, color: 'from-teal-500 to-emerald-600' },
          { href: '/dashboard/pipeline', title: 'View pipeline', desc: 'See all deals & stage progress', icon: TrendingUp, color: 'from-purple-500 to-violet-600' },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="card card-hover p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.color} grid place-items-center shrink-0 shadow-md`}>
              <a.icon className="w-5 h-5 text-white" strokeWidth={2.3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm">{a.title}</div>
              <div className="text-xs text-slate-500 truncate">{a.desc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
