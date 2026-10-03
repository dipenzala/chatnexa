'use client';
import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MessageSquare, Users, Megaphone, Target, TrendingUp, Wallet,
  ArrowRight, Send, Bot, Plus, Sparkles, CheckCircle2, AlertCircle,
  Zap, Phone, Shield, Gift, Award, ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function DashboardHome() {
  const { data: me } = useSWR('/api/v1/auth/me', api.get);
  const { data: overview } = useSWR('/api/v1/analytics/overview', api.get, { refreshInterval: 20000 });
  const { data: waDetails } = useSWR('/api/v1/test-number/whatsapp-details', api.get, { refreshInterval: 30000 });

  const firstName = (me?.user?.name || '').split(' ')[0] || 'there';
  const waConnected = waDetails?.connected;

  const stats = [
    { label: 'WhatsApp API Status', value: waConnected ? 'LIVE' : 'OFFLINE', icon: Shield, badge: waConnected ? 'badge-mint' : 'badge-rose', href: '/dashboard/wa-test' },
    { label: 'Quality Rating', value: waDetails?.quality || 'N/A', icon: Award, badge: waDetails?.quality === 'GREEN' ? 'badge-mint' : 'badge-peach', href: '/dashboard/wa-test' },
    { label: 'Remaining Quota', value: 'UNLIMITED', icon: Zap, badge: 'badge-blue', href: '/dashboard/settings' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
              <Sparkles className="w-3 h-3" /> Welcome back
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">Namaste, {firstName} 👋</h2>
            <p className="mt-1.5 text-sm text-white/90 max-w-xl">Here's your WhatsApp business at a glance.</p>
          </div>
          <Link href="/dashboard/inbox" className="inline-flex items-center gap-2 rounded-xl bg-white text-emerald-700 px-5 py-3 font-bold shadow-lg hover:-translate-y-0.5 transition-all shrink-0">
            <MessageSquare className="w-4 h-4" /> Open Live Chat
          </Link>
        </div>
      </motion.div>

      {/* Status Cards (AiSensy style) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={s.href} className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{s.label}</span>
                <s.icon className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  s.value === 'LIVE' || s.value === 'GREEN' ? 'bg-emerald-50 text-emerald-700' :
                  s.value === 'OFFLINE' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {s.value === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  {s.value}
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Setup Progress */}
      {!waConnected && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 grid place-items-center shrink-0">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg">Setup Your WhatsApp Business Account</div>
              <p className="text-sm text-slate-600 mt-1">Complete setup in under 10 minutes to start sending messages.</p>
              <Link href="/dashboard/setup" className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-white px-4 py-2 font-semibold mt-3 hover:bg-amber-600 transition-colors">
                <Phone className="w-4 h-4" /> Continue Setup
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Contacts', value: overview?.contacts?.total ?? 0, sub: `+${overview?.contacts?.new_30d ?? 0} this month`, icon: Users, color: 'from-blue-500 to-indigo-600', href: '/dashboard/contacts' },
          { label: 'Messages', value: overview?.messages?.total ?? 0, sub: `${overview?.messages?.outbound ?? 0} sent`, icon: MessageSquare, color: 'from-emerald-500 to-teal-600', href: '/dashboard/inbox' },
          { label: 'Campaigns', value: overview?.campaigns?.total ?? 0, sub: `${overview?.campaigns?.running ?? 0} running`, icon: Megaphone, color: 'from-orange-500 to-red-500', href: '/dashboard/campaigns' },
          { label: 'Leads', value: overview?.leads?.total ?? 0, sub: `${overview?.leads?.new ?? 0} new`, icon: Target, color: 'from-rose-500 to-pink-600', href: '/dashboard/leads' },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
            <Link href={k.href} className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} grid place-items-center shadow-md`}>
                  <k.icon className="w-5 h-5 text-white" strokeWidth={2.4} />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight">{k.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{k.sub}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">{k.label}</div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="font-bold text-lg mb-3">Quick Actions</h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/dashboard/campaigns', label: 'New Campaign', desc: 'Send broadcast', icon: Send, color: 'from-orange-500 to-red-500' },
            { href: '/dashboard/ai-templates', label: 'AI Template', desc: 'Generate with AI', icon: Sparkles, color: 'from-purple-500 to-violet-600' },
            { href: '/dashboard/wa-test', label: 'Test Number', desc: 'Verify WhatsApp', icon: Phone, color: 'from-emerald-500 to-teal-600' },
            { href: '/dashboard/contacts', label: 'Add Contact', desc: 'Import CSV', icon: Users, color: 'from-blue-500 to-indigo-600' },
          ].map((a, i) => (
            <motion.div key={a.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
              <Link href={a.href} className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-all">
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

      {/* Bottom Promo (like AiSensy Refer & Earn) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/client-love" className="block bg-gradient-to-br from-emerald-50 to-lime-50 border border-emerald-200 rounded-2xl p-6 hover:shadow-lg transition-all">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-lime-500 grid place-items-center shadow-md shrink-0">
              <Gift className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg">Refer & Earn</div>
              <p className="text-sm text-slate-600 mt-1">Refer a friend and earn ₹2000 in wallet credits.</p>
              <div className="inline-flex items-center gap-2 mt-3 rounded-lg bg-white border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <Award className="w-3.5 h-3.5" /> Total earned: ₹{Number(overview?.revenue?.collected || 0).toFixed(0)}
              </div>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/growth" className="block bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-6 hover:shadow-lg transition-all">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center shadow-md shrink-0">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg">Growth AI</div>
              <p className="text-sm text-slate-600 mt-1">Upsell engine, churn prediction and revenue forecast.</p>
              <div className="inline-flex items-center gap-2 mt-3 text-xs font-bold text-purple-700">
                Open Dashboard <ExternalLink className="w-3 h-3" />
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
