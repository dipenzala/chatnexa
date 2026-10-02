'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles, FileText, Zap, AlertTriangle, TestTube2, MessageSquare,
  Users, DollarSign, Mic, Clock, History, GitMerge, Radio, FileSignature,
  Phone, Globe, Search, BarChart3, HelpCircle, Languages, QrCode, Eye,
  ArrowRight,
} from 'lucide-react';

const TOOLS = [
  { href: '/dashboard/mega/rag', icon: FileText, title: 'PDF/DOCX Upload', desc: 'Train AI from documents', color: 'from-blue-500 to-indigo-600', badge: 'NEW' },
  { href: '/dashboard/mega/keywords', icon: Zap, title: 'Keyword Auto-Reply', desc: 'Instant replies on keywords', color: 'from-amber-500 to-orange-600', badge: 'NEW' },
  { href: '/dashboard/mega/sentiment', icon: AlertTriangle, title: 'Sentiment Alerts', desc: 'Catch unhappy customers', color: 'from-rose-500 to-red-600', badge: 'NEW' },
  { href: '/dashboard/mega/ab-tests', icon: TestTube2, title: 'A/B Testing', desc: 'Compare templates, pick winner', color: 'from-purple-500 to-violet-600', badge: 'NEW' },
  { href: '/dashboard/mega/saved-replies', icon: MessageSquare, title: 'Saved Replies', desc: 'Reusable agent responses', color: 'from-teal-500 to-emerald-600', badge: 'NEW' },
  { href: '/dashboard/mega/voice-notes', icon: Mic, title: 'Voice Notes', desc: 'AI-generated Hinglish audio', color: 'from-pink-500 to-rose-600', badge: 'AI' },
  { href: '/dashboard/mega/merge', icon: GitMerge, title: 'Contact Merge', desc: 'Find & merge duplicates', color: 'from-cyan-500 to-blue-600' },
  { href: '/dashboard/mega/invoices', icon: FileSignature, title: 'GST Invoices', desc: 'Auto-generate tax invoices', color: 'from-lime-500 to-green-600' },
  { href: '/dashboard/mega/forms', icon: FileText, title: 'WhatsApp Forms', desc: 'Collect data, auto-create leads', color: 'from-orange-500 to-red-500' },
  { href: '/dashboard/mega/calls', icon: Phone, title: 'Outbound Calls', desc: 'IVR via Exotel', color: 'from-indigo-500 to-purple-600' },
  { href: '/dashboard/mega/status', icon: Radio, title: 'Status Broadcast', desc: 'Reach all customers free', color: 'from-fuchsia-500 to-pink-600' },
  { href: '/dashboard/mega/qr', icon: QrCode, title: 'UPI QR Code', desc: 'Instant payment QR', color: 'from-emerald-500 to-teal-600' },
  { href: '/dashboard/mega/broadcast-preview', icon: Eye, title: 'Broadcast Preview', desc: 'See before you send', color: 'from-slate-500 to-slate-700' },
  { href: '/dashboard/mega/team-performance', icon: BarChart3, title: 'Team Performance', desc: 'Agent leaderboard', color: 'from-yellow-500 to-amber-600' },
  { href: '/dashboard/mega/green-tick', icon: HelpCircle, title: 'Green Tick Helper', desc: 'Meta verification guide', color: 'from-green-500 to-emerald-600' },
  { href: '/dashboard/mega/copy-assistant', icon: Languages, title: 'Copy Assistant', desc: 'Hinglish rewrite with AI', color: 'from-violet-500 to-purple-600' },
];

export default function MegaHub() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> Advanced Features
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          16 premium tools to grow your WhatsApp business
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {TOOLS.map((t, i) => (
          <motion.div
            key={t.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Link href={t.href} className="card card-hover p-5 relative block h-full">
              {t.badge && (
                <span className={`absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  t.badge === 'AI' ? 'bg-purple-100 text-purple-700' : 'bg-mint-100 text-mint-700'
                }`}>{t.badge}</span>
              )}
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${t.color} grid place-items-center shadow-md mb-3`}>
                <t.icon className="w-5 h-5 text-white" strokeWidth={2.3} />
              </div>
              <div className="font-bold text-sm">{t.title}</div>
              <div className="text-[11px] text-slate-500 mt-1">{t.desc}</div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
