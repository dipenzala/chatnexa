'use client';
import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Sparkles, MessageSquare } from 'lucide-react';

function AnimatedPrice({ value, prefix = '₹', decimals = 2 }: { value: number; prefix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [display, setDisplay] = useState('0.00');

  useEffect(() => {
    if (!inView) return;
    const duration = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay((value * eased).toFixed(decimals));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, decimals]);

  return <span ref={ref} className="tabular-nums tracking-tight">{prefix}{display}</span>;
}

function PriceRow({ label, value, isFree, delay }: { label: string; value: number | 'FREE'; isFree?: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
    >
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-bold">
        {isFree ? (
          <span className="text-mint-600 font-extrabold tracking-wide">FREE</span>
        ) : (
          <span className="text-ink"><AnimatedPrice value={value as number} /></span>
        )}
      </span>
    </motion.div>
  );
}

export function PricingCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative max-w-md mx-auto"
    >
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#25D366] to-[#1E5EE8] px-4 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-[#25D366]/30"
        >
          <Sparkles className="w-3 h-3" />
          Recommended
        </motion.div>
      </div>

      <div className="relative rounded-3xl bg-white border-2 border-[#25D366]/30 shadow-[0_20px_60px_-20px_rgba(37,211,102,0.25)] p-7 sm:p-8 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br from-[#25D366]/10 to-[#1E5EE8]/10 blur-2xl pointer-events-none" />

        <div className="relative">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#1E5EE8] grid place-items-center shadow-lg shadow-[#25D366]/30"
          >
            <MessageSquare className="w-7 h-7 text-white" strokeWidth={2.5} />
          </motion.div>

          <motion.h3
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink"
          >
            Pay Per Message
          </motion.h3>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="mt-1.5 text-sm text-slate-500"
          >
            No monthly fee. Pay only for what you send.
          </motion.p>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          <div className="space-y-0">
            <PriceRow label="Marketing message" value={1.25} delay={0.3} />
            <PriceRow label="Utility message" value={0.20} delay={0.35} />
            <PriceRow label="Service message" value="FREE" isFree delay={0.4} />
            <PriceRow label="AI reply" value={0.30} delay={0.45} />
          </div>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          <ul className="space-y-2.5">
            {[
              'No monthly subscription',
              'Pay only for usage',
              'All features unlocked',
              'AI chatbot included',
            ].map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + i * 0.06 }}
                className="flex items-start gap-2.5 text-sm text-slate-600"
              >
                <Check className="w-4 h-4 text-[#25D366] mt-0.5 shrink-0" strokeWidth={3} />
                {f}
              </motion.li>
            ))}
          </ul>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.75 }}
            className="mt-7"
          >
            <Link
              href="/signup"
              className="group relative flex items-center justify-center gap-2 w-full rounded-2xl bg-gradient-to-r from-[#25D366] to-[#1E5EE8] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-[#25D366]/25 hover:shadow-xl hover:shadow-[#25D366]/35 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
            >
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none"
              />
              <span className="relative z-10 flex items-center gap-2">
                Choose Pay Per Message
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </motion.div>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            No credit card required · Cancel anytime
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default PricingCard;
