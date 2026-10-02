'use client';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  MessageSquare, Bot, Users, Megaphone, BarChart3, CreditCard, Phone, Zap,
  Check, ArrowRight, Sparkles, Brain, Flame, TrendingUp, Target, Clock,
  ShieldCheck, Rocket, Star, Play, Award, Layers, Cpu, Network, Wand2,
  Quote, ChevronDown, X, DollarSign, Globe, Lock, CheckCircle2, ArrowUpRight,
  Twitter, Linkedin, Github, Mail, MapPin, Send, GraduationCap,
  Home as HomeIcon, ShoppingBag, Stethoscope, Wrench, Briefcase,
  Database, FileSpreadsheet, Webhook, UserPlus,
} from 'lucide-react';
import { PricingCard } from '@/components/PricingCard';

/* ============================================================
   HOOKS
============================================================ */
function useIsDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (hover: hover)');
    setD(mq.matches);
    const h = (e: MediaQueryListEvent) => setD(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return d;
}

/* ============================================================
   CURSOR FOLLOWER
============================================================ */
function CursorFollower() {
  const isDesktop = useIsDesktop();
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const sx = useSpring(mx, { stiffness: 300, damping: 30, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 300, damping: 30, mass: 0.5 });

  useEffect(() => {
    if (!isDesktop) return;
    const h = (e: MouseEvent) => { mx.set(e.clientX); my.set(e.clientY); };
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, [isDesktop, mx, my]);

  if (!isDesktop) return null;
  return (
    <motion.div
      style={{ x: sx, y: sy, translateX: '-50%', translateY: '-50%' }}
      className="pointer-events-none fixed top-0 left-0 z-[100] w-8 h-8 rounded-full bg-[#25D366]/30 mix-blend-multiply blur-md"
    />
  );
}

/* ============================================================
   SCROLL PROGRESS
============================================================ */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#25D366] via-primary to-peach origin-left z-[60]"
    />
  );
}

/* ============================================================
   MAGNETIC BUTTON
============================================================ */
function MagneticButton({ children, className = '', href = '#' }: { children: React.ReactNode; className?: string; href?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20 });
  const sy = useSpring(y, { stiffness: 300, damping: 20 });

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * 14);
    y.set(((e.clientY - r.top) / r.height - 0.5) * 14);
  }
  function onLeave() { x.set(0); y.set(0); }

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.a>
  );
}

/* ============================================================
   WORD REVEAL
============================================================ */
function Reveal({ text, delay = 0, className = '' }: { text: string; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const words = text.split(' ');
  return (
    <span ref={ref} className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.6, delay: delay + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {w}&nbsp;
        </motion.span>
      ))}
    </span>
  );
}

/* ============================================================
   MARQUEE
============================================================ */
function Marquee({ items, speed = 30 }: { items: string[]; speed?: number }) {
  const [list] = useState(() => [...items, ...items]);
  return (
    <div className="overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-canvas to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-canvas to-transparent z-10 pointer-events-none" />
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
        className="flex gap-16 w-max"
      >
        {list.map((it, i) => (
          <div key={i} className="text-2xl sm:text-3xl font-bold text-slate-300 whitespace-nowrap tracking-tight">
            {it}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* ============================================================
   BENTO CARD
============================================================ */
function BentoCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative overflow-hidden rounded-3xl bg-white border border-slate-200/70 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_20px_60px_-20px_rgba(37,99,235,0.25)] ${className}`}
    >
      {hover && (
        <div
          className="pointer-events-none absolute inset-0 opacity-60 transition-opacity"
          style={{
            background: `radial-gradient(400px circle at ${pos.x}px ${pos.y}px, rgba(37,211,102,0.08), transparent 40%)`,
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

/* ============================================================
   DATA
============================================================ */
const LOGOS = ['Meta', 'WhatsApp Cloud API', 'Razorpay', 'OpenAI', 'Exotel', 'Cloudinary', 'Neon', 'Upstash', 'Vercel'];

const BENTO = [
  { span: 'md:col-span-2 md:row-span-2', icon: Database, title: 'Official Meta WhatsApp API', desc: 'Verified business profile, green tick eligibility, unlimited broadcasting, 99.9% uptime. Built on WhatsApp Cloud API v19.', accent: 'from-[#25D366] to-[#0FA958]', demo: 'score' },
  { span: '', icon: Wand2, title: 'AI Deal Score', desc: 'Every conversation scored 0-100 for buying intent.', accent: 'from-primary to-blue-600' },
  { span: '', icon: Clock, title: 'Smart Follow-ups', desc: 'Recover 20% of ghosted leads with auto-nudges.', accent: 'from-cyan-500 to-blue-600' },
  { span: '', icon: Users, title: 'Shared Team Inbox', desc: 'Unlimited agents on one WhatsApp number.', accent: 'from-purple-500 to-violet-600' },
  { span: '', icon: CreditCard, title: 'Payment Links', desc: 'Razorpay + UPI. Customer pays without leaving chat.', accent: 'from-amber-500 to-orange-600' },
  { span: 'md:col-span-2', icon: Bot, title: 'AI Auto-Reply with RAG', desc: 'GPT-4o-mini answers from your knowledge base. Hindi, English, Hinglish — auto-detected.', accent: 'from-teal-500 to-emerald-600', demo: 'chat' },
];

const COMPARISON = [
  { feature: 'Monthly fee', us: '₹0', them: '₹1,500+' },
  { feature: 'Broadcast limit', us: 'Unlimited', them: '256 contacts' },
  { feature: 'Green tick', us: 'Eligible', them: 'No' },
  { feature: 'Team agents', us: 'Unlimited', them: '1 device' },
  { feature: 'AI Auto-reply', us: 'Included', them: 'Extra ₹2,000' },
  { feature: 'Webhooks', us: 'Yes', them: 'No' },
  { feature: 'Setup time', us: '10 min', them: '2-3 days' },
];

const STEPS = [
  { n: '01', t: 'Connect API', d: 'Paste Meta Phone Number ID + Access Token. Instant validation.', icon: MessageSquare },
  { n: '02', t: 'Add contacts', d: 'CSV import, CRM sync, or start fresh. No limits.', icon: FileSpreadsheet },
  { n: '03', t: 'Broadcast', d: 'Send to 10,000 contacts. Track delivery in real-time.', icon: Megaphone },
  { n: '04', t: 'Score & close', d: 'AI ranks every deal. NBA suggests exact next message.', icon: Target },
  { n: '05', t: 'Collect payment', d: 'Send Razorpay link. Customer pays inside WhatsApp.', icon: CreditCard },
];

const TESTIMONIALS = [
  { name: 'Rajesh Kumar', role: 'Sharma Coaching Classes', quote: '3,200 students ko ek saath update bhejte hain. Pehle copy-paste me pura din jaata tha.', avatar: 'R' },
  { name: 'Anita Deshmukh', role: 'D2C Brand, Mumbai', quote: 'Order confirmations, shipping updates — sab automatic. Support tickets 62% kam ho gaye.', avatar: 'A' },
  { name: 'Vikram Mehta', role: 'Real Estate, Ahmedabad', quote: 'Site visit bookings 3x. AI 24/7 reply karta hai, main subah confirmed bookings dekhta hu.', avatar: 'V' },
  { name: 'Priya Iyer', role: 'Clinic Owner, Bangalore', quote: 'Appointment reminders ne no-shows 70% kam kiye. Prescriptions WhatsApp pe.', avatar: 'P' },
  { name: 'Arjun Singh', role: 'Agency, Delhi', quote: '5 clients ke WhatsApp API handle karte hain. Alag number, alag team, ek dashboard.', avatar: 'A' },
  { name: 'Neha Verma', role: 'Fitness Studio, Pune', quote: 'Batch reminders, fees, feedback — sab WhatsApp pe. Zero monthly fee means pure profit.', avatar: 'N' },
];

const FAQS = [
  { q: 'What is WhatsApp Business API?', a: 'Meta\'s official way for businesses to send messages at scale — verified profile, green tick, unlimited broadcasting, team collaboration and automation. Unlike the free Business app (256 contacts, one device), the API is built for growing businesses.' },
  { q: 'Do I need my own WhatsApp number?', a: 'Yes — a number not already registered on WhatsApp Business app. We guide you through Meta Cloud API setup in under 10 minutes.' },
  { q: 'How long does green tick take?', a: 'Once you submit business documents to Meta, verification typically takes 3-7 days. We help prepare the exact documents to avoid rejection.' },
  { q: 'Is there really no monthly fee?', a: 'Correct. No subscription, no setup fee, no per-seat charges. You pay only per message: Marketing ₹1.25, Utility ₹0.20, AI reply ₹0.30. Service messages FREE.' },
  { q: 'How is ChatNexa different?', a: 'We are WhatsApp API-first. Everything — campaigns, inbox, AI, templates, payments, analytics — designed around WhatsApp. Plus AI Deal Score and auto follow-ups that others don\'t have.' },
  { q: 'Can I integrate with my CRM?', a: 'Yes. REST API + webhooks. Common integrations: Shopify, Zoho, HubSpot, Google Sheets, Tally. Free setup help for your first webhook.' },
];

/* ============================================================
   MAIN
============================================================ */
export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: heroProg } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroScale = useTransform(heroProg, [0, 1], [1, 0.9]);
  const heroOpacity = useTransform(heroProg, [0, 0.8], [1, 0]);
  const heroY = useTransform(heroProg, [0, 1], [0, 100]);

  const { scrollYProgress: showProg } = useScroll({ target: showcaseRef, offset: ['start end', 'end start'] });
  const rotateX = useTransform(showProg, [0, 0.5, 1], [25, 0, -25]);
  const scale = useTransform(showProg, [0, 0.5, 1], [0.85, 1, 0.85]);
  const opacity = useTransform(showProg, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3]);

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-canvas overflow-x-hidden">
      <ScrollProgress />
      <CursorFollower />

      {/* Noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[5] opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ============ NAV ============ */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl bg-white/70 border-b border-slate-900/5">
        <nav className="mx-auto max-w-[1200px] px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-slate-200/80 grid place-items-center group-hover:scale-105 transition-transform">
              <Image src="/logo.png" alt="ChatNexa" width={32} height={32} className="object-contain w-full h-full" priority />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight">ChatNexa</span>
              <span className="text-[8px] font-bold text-[#25D366] uppercase tracking-[0.15em] mt-0.5">WhatsApp API Platform</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-slate-700">
            <a href="#features" className="hover:text-ink transition-colors">Features</a>
            <a href="#ai" className="hover:text-ink transition-colors">AI</a>
            <a href="#compare" className="hover:text-ink transition-colors">Compare</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-ink transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:block text-[13px] font-medium text-slate-700 hover:text-ink px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/signup" className="text-[13px] font-semibold text-white bg-ink hover:bg-slate-800 rounded-full px-4 py-1.5 transition-all">
              Get WhatsApp API
            </Link>
          </div>
        </nav>
      </header>

      {/* ============ HERO ============ */}
      <section ref={heroRef} className="relative pt-32 sm:pt-40 pb-20 sm:pb-32 px-6">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <motion.div
            animate={{ x: [0, 80, 0], y: [0, -60, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-0 -left-40 w-[600px] h-[600px] rounded-full blur-[100px] opacity-30"
            style={{ background: 'radial-gradient(circle, #25D366 0%, transparent 70%)' }}
          />
          <motion.div
            animate={{ x: [0, -60, 0], y: [0, 60, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-20 -right-40 w-[600px] h-[600px] rounded-full blur-[100px] opacity-30"
            style={{ background: 'radial-gradient(circle, #1E5EE8 0%, transparent 70%)' }}
          />
          <motion.div
            animate={{ x: [0, 40, 0], y: [0, -40, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[100px] opacity-20"
            style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }}
          />
        </div>

        <motion.div style={{ scale: heroScale, opacity: heroOpacity, y: heroY }} className="mx-auto max-w-[1100px] text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200/80 pl-1 pr-3.5 py-1 text-xs font-medium text-slate-600 shadow-sm"
          >
            <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366]">
              <MessageSquare className="w-3 h-3 text-white" strokeWidth={2.5} />
              <span className="absolute inset-0 rounded-full bg-[#25D366]/40 animate-ping" />
            </span>
            Official Meta WhatsApp Cloud API v19
            <span className="h-3 w-px bg-slate-200" />
            <span className="text-[#0FA958] font-semibold">Verified Business Platform</span>
          </motion.div>

          <h1 className="mt-8 text-5xl sm:text-7xl md:text-8xl lg:text-[110px] font-bold tracking-[-0.045em] leading-[0.92] text-ink">
            <Reveal text="The WhatsApp API" />
            <br />
            <span className="bg-gradient-to-r from-[#25D366] via-[#0FA958] to-[#1E5EE8] bg-clip-text text-transparent">
              <Reveal text="that closes deals." delay={0.3} />
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-8 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed tracking-tight px-2"
          >
            Reach <b className="text-ink">10,000+ customers</b> in minutes. Broadcast campaigns, receive replies,
            collect payments, and let AI handle the rest — on your <b className="text-ink">own verified WhatsApp number</b>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 px-4"
          >
            <MagneticButton
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-7 py-3.5 text-[15px] font-semibold hover:bg-[#1FA855] transition-all shadow-lg shadow-[#25D366]/25 w-full sm:w-auto justify-center"
            >
              <MessageSquare className="w-4 h-4" />
              Get WhatsApp API — Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </MagneticButton>
            <MagneticButton
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 text-ink px-7 py-3.5 text-[15px] font-semibold hover:border-slate-300 transition-all w-full sm:w-auto justify-center"
            >
              <Play className="w-4 h-4" /> Watch demo
            </MagneticButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500"
          >
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#25D366]" /> No credit card</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#25D366]" /> ₹100 free credit</span>
            <span className="hidden sm:flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#25D366]" /> Setup in 10 min</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ============ MARQUEE ============ */}
      <section className="py-12 border-y border-slate-200/60 bg-white/50">
        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">
          Built on trusted infrastructure
        </p>
        <Marquee items={LOGOS} speed={40} />
      </section>

      {/* ============ PRODUCT SHOWCASE (3D scroll) ============ */}
      <section ref={showcaseRef} className="py-20 sm:py-32 px-6 overflow-hidden" style={{ perspective: '2000px' }}>
        <div className="mx-auto max-w-[1200px]">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-bold text-[#0FA958] uppercase tracking-[0.2em] mb-3">The platform</div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]">
              Not a dashboard. A<br />
              <span className="bg-gradient-to-r from-[#25D366] to-[#1E5EE8] bg-clip-text text-transparent">
                WhatsApp growth engine.
              </span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed">
              Every metric on this screen exists to help you close one more deal on WhatsApp.
            </p>
          </div>

          <motion.div
            style={{ rotateX, scale, opacity, transformStyle: 'preserve-3d' }}
            className="relative"
          >
            <div className="rounded-[28px] bg-gradient-to-b from-slate-900 via-ink to-black p-2 shadow-[0_80px_120px_-40px_rgba(0,0,0,0.5)] border border-slate-800">
              <div className="rounded-[22px] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-white/10" />
                    <span className="w-3 h-3 rounded-full bg-white/10" />
                    <span className="w-3 h-3 rounded-full bg-white/10" />
                  </div>
                  <div className="ml-4 flex-1 max-w-sm rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-[11px] text-slate-500 font-mono">
                    chatnexa.in/dashboard
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#25D366]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" /> LIVE
                  </div>
                </div>

                <div className="p-6 sm:p-10 grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-2 rounded-2xl bg-gradient-to-br from-[#25D366]/15 to-[#1E5EE8]/10 border border-[#25D366]/20 p-5 sm:p-7">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="text-[11px] font-bold text-[#25D366] uppercase tracking-wider">WhatsApp Broadcast</div>
                        <div className="text-2xl sm:text-3xl font-bold text-white mt-1">24 hot leads ready</div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 grid place-items-center">
                        <Brain className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="h-24 sm:h-32 flex items-end gap-1.5">
                      {[35, 42, 38, 55, 62, 71, 58, 82, 75, 88, 91, 87, 94, 89, 96].map((h, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          whileInView={{ height: `${h}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: i * 0.04 }}
                          className="flex-1 rounded-t-sm bg-gradient-to-t from-[#25D366] to-[#1E5EE8]"
                        />
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Last 15 days</span>
                      <span className="text-[#25D366] font-bold">↑ 41% engagement</span>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center mb-4">
                      <Wand2 className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">AI Suggests</div>
                    <div className="text-sm text-white mt-2 leading-relaxed">
                      Send payment link to Rahul — 87% intent detected.
                    </div>
                    <div className="mt-4 flex gap-1.5">
                      <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold text-white">Use</span>
                      <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-400">Skip</span>
                    </div>
                  </div>

                  {[
                    { l: 'Deals closed', v: '18', i: Award, c: 'from-mint to-emerald-600' },
                    { l: 'AI replies', v: '234', i: Bot, c: 'from-primary to-blue-600' },
                    { l: 'Revenue', v: '₹4.2L', i: TrendingUp, c: 'from-peach to-orange-600' },
                  ].map((k) => (
                    <div key={k.l} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${k.c} grid place-items-center mb-4`}>
                        <k.i className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-2xl font-bold text-white">{k.v}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">{k.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ BENTO GRID ============ */}
      <section id="features" className="py-20 sm:py-32 px-6 bg-white">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl mb-16">
            <div className="text-xs font-bold text-[#0FA958] uppercase tracking-[0.2em] mb-3">Everything included</div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]">
              The complete WhatsApp API.
              <br />
              <span className="text-slate-400">Zero monthly fees.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(200px,auto)]">
            {BENTO.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className={b.span}
              >
                <BentoCard className="h-full p-6 sm:p-8 group">
                  {b.demo === 'score' ? (
                    <div className="h-full flex flex-col">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${b.accent} grid place-items-center mb-6 shadow-lg`}>
                        <b.icon className="w-6 h-6 text-white" strokeWidth={2.3} />
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">{b.title}</h3>
                      <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed flex-1">{b.desc}</p>
                      <div className="mt-6 grid grid-cols-3 gap-2">
                        {[
                          { l: 'Score', v: '94', c: 'text-rose-600' },
                          { l: 'Intent', v: 'High', c: 'text-mint-600' },
                          { l: 'Stage', v: 'Closing', c: 'text-primary-600' },
                        ].map((s) => (
                          <div key={s.l} className="rounded-xl bg-slate-50 p-3 text-center">
                            <div className={`text-xl font-bold ${s.c}`}>{s.v}</div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">{s.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : b.demo === 'chat' ? (
                    <div className="h-full grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${b.accent} grid place-items-center mb-6 shadow-lg`}>
                          <b.icon className="w-6 h-6 text-white" strokeWidth={2.3} />
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">{b.title}</h3>
                        <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">{b.desc}</p>
                      </div>
                      <div className="rounded-2xl bg-[#F0F2F5] p-4 space-y-2.5">
                        <div className="flex justify-start">
                          <div className="max-w-[80%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">
                            Class 12 ki fees kitni hai?
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <div className="max-w-[80%] rounded-lg rounded-tr-none bg-[#DCF8C6] px-3 py-2 text-xs text-slate-800 shadow-sm">
                            ₹45,000 per year hai, jisme study material included hai. EMI bhi available. 😊
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 justify-end pt-1">
                          <Bot className="w-3 h-3 text-[#25D366]" />
                          <span className="text-[10px] text-slate-400">AI reply in 1.2s</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${b.accent} grid place-items-center mb-5 shadow-lg`}>
                        <b.icon className="w-5 h-5 text-white" strokeWidth={2.3} />
                      </div>
                      <h3 className="text-lg font-bold tracking-tight">{b.title}</h3>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">{b.desc}</p>
                    </div>
                  )}
                </BentoCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ DARK SECTION — Stats ============ */}
      <section id="ai" className="py-24 sm:py-32 px-6 bg-ink text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-[#25D366]/40 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-primary/40 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-[1200px] relative">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="text-xs font-bold text-[#25D366] uppercase tracking-[0.2em] mb-3">By the numbers</div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]">
              98% of your customers
              <br />
              <span className="bg-gradient-to-r from-[#25D366] via-primary to-peach bg-clip-text text-transparent">
                are already on WhatsApp.
              </span>
            </h2>
            <p className="mt-6 text-white/60 text-base sm:text-lg leading-relaxed">
              India has 535 million+ WhatsApp users. Email gets 20% open rate. WhatsApp gets 98%. Your customers are already there — you just need to reach them properly.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">
            {[
              { v: '98%', l: 'Message open rate' },
              { v: '3.2x', l: 'Conversion lift' },
              { v: '10,000+', l: 'Indian businesses' },
              { v: '₹0', l: 'Monthly fee' },
            ].map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                  {s.v}
                </div>
                <div className="mt-3 text-xs sm:text-sm text-white/50 font-medium">{s.l}</div>
              </motion.div>
            ))}
          </div>

          <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { i: Database, t: 'Official Meta API', d: 'WhatsApp Cloud API v19. Verified business profile. Green tick eligible.' },
              { i: Users, t: 'Unlimited Team', d: 'Multiple agents on one number. No per-seat charges. Ever.' },
              { i: ShieldCheck, t: 'Zero Lock-in', d: 'No monthly fee. Pay per message. Stop anytime. No questions.' },
            ].map((f, i) => (
              <motion.div
                key={f.t}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur hover:bg-white/8 transition-colors"
              >
                <f.i className="w-6 h-6 text-[#25D366] mb-4" strokeWidth={2.2} />
                <div className="font-bold">{f.t}</div>
                <div className="mt-1.5 text-sm text-white/60 leading-relaxed">{f.d}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WORKFLOW — horizontal scroll ============ */}
      <section className="py-20 sm:py-32 px-6 bg-white overflow-hidden">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl mb-16">
            <div className="text-xs font-bold text-[#0FA958] uppercase tracking-[0.2em] mb-3">The workflow</div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]">
              From enquiry
              <br />
              <span className="text-slate-400">to payment. On WhatsApp.</span>
            </h2>
          </div>

          <div className="overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory scrollbar-hide">
            <div className="flex gap-5 min-w-max">
              {STEPS.map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="w-[300px] sm:w-[340px] snap-start shrink-0 rounded-3xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/70 p-7 hover:shadow-[0_20px_60px_-20px_rgba(37,211,102,0.2)] hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="text-5xl font-bold text-slate-200 tracking-tight mb-6">{s.n}</div>
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#1E5EE8] grid place-items-center shadow-md mb-5">
                    <s.icon className="w-5 h-5 text-white" strokeWidth={2.3} />
                  </div>
                  <h3 className="font-bold text-xl tracking-tight">{s.t}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.d}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ COMPARISON ============ */}
      <section id="compare" className="py-20 sm:py-32 px-6 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-[1000px]">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-bold text-[#0FA958] uppercase tracking-[0.2em] mb-3">Comparison</div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]">
              Every other tool
              <br />
              <span className="text-slate-400">does half of this.</span>
            </h2>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200/70 overflow-hidden shadow-[0_20px_60px_-30px_rgba(15,23,42,0.15)]">
            <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50/60">
              <div className="px-6 sm:px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-500">Feature</div>
              <div className="px-6 sm:px-8 py-5 text-xs font-bold uppercase tracking-wider text-[#0FA958] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> ChatNexa
              </div>
              <div className="px-6 sm:px-8 py-5 text-xs font-bold uppercase tracking-wider text-slate-400">Others</div>
            </div>
            {COMPARISON.map((r, i) => (
              <motion.div
                key={r.feature}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="grid grid-cols-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/40 transition-colors"
              >
                <div className="px-6 sm:px-8 py-5 text-sm font-medium text-slate-700">{r.feature}</div>
                <div className="px-6 sm:px-8 py-5 flex items-center gap-2 text-sm font-semibold text-ink">
                  <CheckCircle2 className="w-4 h-4 text-[#25D366] shrink-0" strokeWidth={2.5} />
                  <span>{r.us}</span>
                </div>
                <div className="px-6 sm:px-8 py-5 flex items-center gap-2 text-sm text-slate-400">
                  <X className="w-4 h-4 text-rose/60 shrink-0" strokeWidth={2.5} />
                  <span>{r.them}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="py-20 sm:py-32 bg-ink text-white overflow-hidden">
        <div className="mx-auto max-w-[1200px] px-6 mb-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div>
              <div className="text-xs font-bold text-[#25D366] uppercase tracking-[0.2em] mb-3">Loved by founders</div>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]">
                10,000+ Indian<br />
                <span className="text-white/40">businesses trust us.</span>
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-peach text-peach" />
                ))}
              </div>
              <div className="text-sm text-white/60">4.9 from 2,400+ reviews</div>
            </div>
          </div>
        </div>

        <div className="relative">
          <motion.div
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
            className="flex gap-5 w-max px-6"
          >
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div
                key={i}
                className="w-[340px] sm:w-[380px] shrink-0 rounded-3xl bg-white/5 border border-white/10 p-7 backdrop-blur"
              >
                <Quote className="w-8 h-8 text-[#25D366]/40 mb-5" />
                <p className="text-white/90 leading-relaxed">"{t.quote}"</p>
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#25D366] to-[#1E5EE8] grid place-items-center font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-white/50">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="py-20 sm:py-32 px-6 bg-white">
        <div className="mx-auto max-w-[1200px]">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-bold text-[#0FA958] uppercase tracking-[0.2em] mb-3">Pricing</div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]">
              ₹0/month.
              <br />
              <span className="text-slate-400">Forever.</span>
            </h2>
            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed">
              Add money to your wallet. Pay only per message. No subscriptions, no hidden charges.
            </p>
          </div>

          <PricingCard />
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="py-20 sm:py-32 px-6 bg-slate-50/60">
        <div className="mx-auto max-w-[1100px]">
          <div className="grid md:grid-cols-[1fr,1.5fr] gap-12 md:gap-20">
            <div>
              <div className="text-xs font-bold text-[#0FA958] uppercase tracking-[0.2em] mb-3">FAQ</div>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-[-0.04em] leading-[1.05]">
                Questions,
                <br />
                <span className="text-slate-400">answered.</span>
              </h2>
              <p className="mt-5 text-slate-600">
                Still curious?{' '}
                <a href="mailto:hi@chatnexa.in" className="text-[#0FA958] font-semibold hover:underline">
                  Email us
                </a>
                .
              </p>
            </div>

            <div className="space-y-2">
              {FAQS.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl bg-white border border-slate-200/70 overflow-hidden hover:border-slate-300 transition-colors"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  >
                    <span className="font-semibold text-[15px] pr-4">{f.q}</span>
                    <motion.div
                      animate={{ rotate: openFaq === i ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 w-8 h-8 rounded-full bg-slate-100 grid place-items-center"
                    >
                      <span className="text-slate-600 text-lg leading-none">+</span>
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="py-24 sm:py-32 px-6 bg-white overflow-hidden">
        <div className="mx-auto max-w-[1100px]">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-[36px] overflow-hidden bg-gradient-to-br from-slate-900 via-ink to-black p-12 sm:p-20 text-center"
          >
            <div className="absolute inset-0 opacity-40">
              <motion.div
                animate={{ x: [0, 60, 0], y: [0, -40, 0] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-[#25D366]/40 blur-[100px]"
              />
              <motion.div
                animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-primary/40 blur-[100px]"
              />
            </div>

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-[11px] font-bold text-[#25D366] mb-6">
                <Rocket className="w-3 h-3" /> 10,000+ businesses already growing
              </div>
              <h2 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-[-0.045em] leading-[1] text-white">
                Ready to reach
                <br />
                <span className="bg-gradient-to-r from-[#25D366] via-primary to-peach bg-clip-text text-transparent">
                  10,000 customers?
                </span>
              </h2>
              <p className="mt-8 text-lg text-white/60 max-w-xl mx-auto leading-relaxed">
                Free forever plan. Official Meta API. Guided onboarding. Start sending in 10 minutes.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                <MagneticButton
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-7 py-3.5 text-base font-semibold hover:bg-[#1FA855] transition-all w-full sm:w-auto justify-center shadow-lg shadow-[#25D366]/25"
                >
                  Get WhatsApp API — Free
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </MagneticButton>
                <MagneticButton
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 text-white px-7 py-3.5 text-base font-semibold hover:bg-white/10 transition-all w-full sm:w-auto justify-center"
                >
                  Sign in
                </MagneticButton>
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50">
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> No credit card</span>
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> ₹100 free credit</span>
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-peach text-peach" /> 4.9 rating</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-ink text-white pt-20 pb-10 px-6">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-12 md:grid-cols-[1.5fr,1fr,1fr,1fr]">
            <div>
              <Link href="/" className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/5 border border-white/10 grid place-items-center">
                  <Image src="/logo.png" alt="ChatNexa" width={36} height={36} className="object-contain w-full h-full" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-lg font-bold tracking-tight">ChatNexa</span>
                  <span className="text-[9px] font-bold text-[#25D366] uppercase tracking-[0.15em] mt-0.5">WhatsApp API Platform</span>
                </div>
              </Link>
              <p className="text-sm text-white/50 leading-relaxed max-w-xs">
                India&apos;s no-monthly-fee WhatsApp Business API platform. Built for SMBs, D2C brands, coaching institutes and agencies.
              </p>

              <div className="mt-7">
                <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Get product updates</div>
                <form
                  onSubmit={(e) => { e.preventDefault(); setEmail(''); alert('Thanks! We will keep you posted.'); }}
                  className="flex gap-2 max-w-sm"
                >
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-3 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#25D366]/50 transition-colors"
                    />
                  </div>
                  <button type="submit" className="rounded-xl bg-[#25D366] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#1FA855] transition-colors shrink-0">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-5">Product</div>
              <ul className="space-y-3 text-sm">
                {[['WhatsApp API', '#features'], ['Features', '#features'], ['Pricing', '#pricing'], ['Compare', '#compare'], ['FAQ', '#faq']].map(([l, h]) => (
                  <li key={l}>
                    <a href={h} className="text-white/70 hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-5">Use cases</div>
              <ul className="space-y-3 text-sm">
                {['D2C & E-commerce', 'Coaching Institutes', 'Real Estate', 'Clinics', 'Agencies'].map((l) => (
                  <li key={l}>
                    <a href="#features" className="text-white/70 hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-5">Legal</div>
              <ul className="space-y-3 text-sm">
                {['Privacy', 'Terms', 'Security', 'DPDP', 'Refunds'].map((l) => (
                  <li key={l}>
                    <a href="#" className="text-white/70 hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <MapPin className="w-3.5 h-3.5" />
              Made in India 🇮🇳 · © {new Date().getFullYear()} ChatNexa
            </div>
            <div className="flex items-center gap-2">
              {[
                { i: Twitter, href: '#' },
                { i: Linkedin, href: '#' },
                { i: Github, href: '#' },
              ].map((s, i) => (
                <a key={i} href={s.href} className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center text-white/60 hover:bg-white/10 hover:text-white transition-all">
                  <s.i className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
