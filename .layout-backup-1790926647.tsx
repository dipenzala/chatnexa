'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, LayoutDashboard, Users, Megaphone, FileText, Inbox, Bot, Target,
  CreditCard, Settings, LogOut, Menu, Wallet, ChevronRight, X, Search,
  TrendingUp, Clock, Zap,
} from 'lucide-react';
import { api, getToken, clearToken } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/setup', label: 'WhatsApp Setup', icon: Phone, badge: 'setup' },
  { href: '/dashboard/client-love', label: 'Client Love', icon: Heart, badge: 'new' },
  { href: '/dashboard/inbox', label: 'Inbox', icon: Inbox, badge: 'new' },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: TrendingUp, badge: 'new' },
  { href: '/dashboard/followups', label: 'Follow-ups', icon: Clock, badge: 'new' },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/leads', label: 'Leads', icon: Target },
  { href: '/dashboard/ai', label: 'AI Studio', icon: Bot },
  { href: '/dashboard/growth', label: 'Growth AI', icon: TrendingUp, badge: 'new' },
  { href: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { href: '/dashboard/seo', label: 'SEO Tools', icon: Search, badge: 'new' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    api.get('/api/v1/auth/me')
      .then((res) => { setMe(res.user); connectSocket(); })
      .catch(() => { clearToken(); router.replace('/login'); })
      .finally(() => setLoading(false));
    return () => disconnectSocket();
  }, [router]);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function logout() { clearToken(); disconnectSocket(); router.replace('/login'); }

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-mint grid place-items-center animate-pulse">
          <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <p className="text-sm text-slate-500">Loading workspace…</p>
      </div>
    </div>
  );

  const filteredNav = search
    ? NAV.filter((n) => n.label.toLowerCase().includes(search.toLowerCase()))
    : NAV;

  const SidebarContent = (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200/80 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-mint grid place-items-center shadow-glow shrink-0">
            <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold tracking-tight leading-none">ChatNexa</div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">{me?.org_name}</div>
          </div>
        </Link>
        <button onClick={() => setOpen(false)} className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Quick find…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-9 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {filteredNav.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-ink'
              }`}
            >
              <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={2.2} />
              <span className="truncate flex-1">{item.label}</span>
              {item.badge === 'new' && !active && (
                <span className="text-[9px] font-bold uppercase tracking-wider rounded-full bg-mint-50 text-mint-600 px-1.5 py-0.5">AI</span>
              )}
              {active && <ChevronRight className="w-3.5 h-3.5 text-primary" />}
            </Link>
          );
        })}
        {filteredNav.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">No matches</p>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200/80 space-y-2 shrink-0">
        <Link href="/dashboard/settings" className="block rounded-xl bg-gradient-to-br from-primary-50 to-mint-50 border border-primary-100 p-3.5 hover:shadow-soft transition-all">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 tracking-wider">
            <Wallet className="w-3.5 h-3.5" /> WALLET
          </div>
          <div className="mt-1 text-lg font-extrabold tracking-tight">₹{Number(me?.wallet_balance ?? 0).toFixed(2)}</div>
          <div className="mt-1 text-[11px] font-semibold text-primary">Top up →</div>
        </Link>

        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-peach to-rose grid place-items-center text-white text-xs font-bold shrink-0">
            {(me?.name || me?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate">{me?.name || 'User'}</div>
            <div className="text-[10px] text-slate-500 truncate">{me?.email}</div>
          </div>
          <button onClick={logout} title="Sign out" className="p-1.5 rounded-lg text-slate-400 hover:text-rose hover:bg-rose-50 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 z-30 w-[248px] border-r border-slate-200/80">
        {SidebarContent}
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 lg:hidden shadow-2xl"
              style={{ width: '85vw', maxWidth: 320 }}
            >
              {SidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 lg:ml-[248px] flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 sticky top-0 z-20 glass border-b border-slate-200/70 flex items-center gap-3 px-4 sm:px-6 shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold tracking-tight truncate text-base sm:text-lg">
              {NAV.find((n) => n.href === pathname)?.label ||
                NAV.find((n) => n.href !== '/dashboard' && pathname.startsWith(n.href))?.label ||
                'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-mint-50 px-3 py-1.5 text-[11px] font-semibold text-mint-600">
              <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
              Live
            </div>
            <Link href="/dashboard/inbox" className="p-2 rounded-xl hover:bg-slate-100 transition-colors relative">
              <Inbox className="w-5 h-5 text-slate-600" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
