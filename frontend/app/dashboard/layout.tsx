'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, MessageSquare, Users, Megaphone, FileText, Bot,
  CreditCard, Settings, LogOut, Menu, X, BarChart3, Zap, Phone,
  Sparkles, Shield, Send, Target, HelpCircle, Wallet, Bell, ArrowLeft,
} from 'lucide-react';
import { api, getToken, clearToken } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/inbox', label: 'Live Chat', icon: MessageSquare },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText },
  { href: '/dashboard/ai-templates', label: 'AI Templates', icon: Sparkles, badge: 'AI' },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: Target },
  { href: '/dashboard/leads', label: 'Leads', icon: Zap },
  { href: '/dashboard/ai', label: 'AI Studio', icon: Bot },
  { href: '/dashboard/wa-test', label: 'WA Test', icon: Send },
  { href: '/dashboard/setup', label: 'Setup', icon: Phone },
  { href: '/dashboard/bsp', label: 'BSP', icon: BarChart3 },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { href: '/dashboard/growth', label: 'Growth', icon: BarChart3 },
  { href: '/dashboard/client-love', label: 'Client Love', icon: Bell },
  { href: '/dashboard/seo', label: 'SEO', icon: HelpCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api.get('/api/v1/auth/me')
      .then((res) => { setMe(res.user); connectSocket(); })
      .catch(() => { clearToken(); router.replace('/login'); })
      .finally(() => setLoading(false));
    return () => disconnectSocket();
  }, [router]);

  useEffect(() => { setOpen(false); }, [pathname]);

  function logout() { clearToken(); disconnectSocket(); router.replace('/login'); }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center animate-pulse">
            <MessageSquare className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  const SidebarContent = (
    <div className="h-full flex flex-col bg-[#0f2a3a] text-white">
      {/* Logo */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center shrink-0 shadow-lg">
          <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm leading-none">ChatNexa</div>
          <div className="text-[10px] text-emerald-300 mt-0.5">WhatsApp AI Suite</div>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-emerald-500/20 text-white border-l-2 border-emerald-400'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2.2} />
              <span className="truncate flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {me?.is_super_admin && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all mt-2 border border-amber-400/30 ${
              pathname === '/admin' ? 'bg-amber-500/20 text-amber-300' : 'text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            <Shield className="w-[18px] h-[18px]" strokeWidth={2.2} />
            <span className="truncate flex-1">Admin Panel</span>
          </Link>
        )}
      </nav>

      {/* Wallet card */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <Link href="/dashboard/settings" className="block rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-300 tracking-wider">
            <Wallet className="w-3.5 h-3.5" /> WALLET BALANCE
          </div>
          <div className="mt-1 text-lg font-bold">₹{Number(me?.wallet_balance ?? 0).toFixed(2)}</div>
        </Link>

        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center text-white text-xs font-bold shrink-0">
            {(me?.name || me?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate">{me?.name || 'User'}</div>
            <div className="text-[10px] text-white/50 truncate">{me?.email}</div>
          </div>
          <button onClick={logout} title="Sign out" className="p-1.5 rounded-lg text-white/50 hover:text-rose-300 hover:bg-rose-500/10">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 z-30 w-[248px]">{SidebarContent}</div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 lg:hidden shadow-2xl"
              style={{ width: '85vw', maxWidth: 300 }}
            >
              {SidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 lg:ml-[248px] flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-20 bg-white border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6 shrink-0">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100">
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold tracking-tight truncate text-base sm:text-lg">
              {NAV.find((n) => n.href === pathname)?.label ||
               NAV.find((n) => n.href !== '/dashboard' && pathname.startsWith(n.href))?.label ||
               (pathname === '/admin' ? 'Admin Panel' : 'Dashboard')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </div>
            <Link href="/dashboard/inbox" className="p-2 rounded-xl hover:bg-slate-100">
              <MessageSquare className="w-5 h-5 text-slate-600" />
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
