'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cake, Gift, Star, Users, Copy, Send, Loader2, Sparkles, Heart,
  Calendar, Trophy, ExternalLink, Settings, X, MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';

const TABS = [
  { id: 'birthdays', label: 'Birthdays & Anniversaries', icon: Cake },
  { id: 'greetings', label: 'Greeting History', icon: MessageSquare },
  { id: 'referrals', label: 'Referral Program', icon: Users },
  { id: 'loyalty', label: 'Loyalty Points', icon: Trophy },
] as const;

export default function ClientLovePage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('birthdays');
  const [busy, setBusy] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [preview, setPreview] = useState('');

  const { data: upcoming, mutate: mutateUpcoming } = useSWR('/api/v1/client-love/upcoming?days=30', api.get);
  const { data: greetings } = useSWR('/api/v1/client-love/greetings', api.get);
  const { data: referrals } = useSWR('/api/v1/client-love/referrals', api.get);
  const { data: loyalty } = useSWR('/api/v1/client-love/loyalty', api.get);

  async function previewGreeting(contact: any, type: 'birthday' | 'anniversary') {
    setSelectedContact(contact);
    setPreview('Generating…');
    try {
      const res = await api.post('/api/v1/client-love/greetings/test', {
        type, contactId: contact.id,
      });
      setPreview(res.preview);
    } catch (e: any) { setPreview(`⚠️ ${e.message}`); }
  }

  async function generateReferral(contact: any) {
    setBusy(true);
    try {
      const res = await api.post(`/api/v1/client-love/referral/generate/${contact.id}`, {});
      alert(`✅ Referral code: ${res.code}\n\nLink: ${res.link}`);
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Heart className="w-6 h-6 text-rose-500" /> Client Love
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Auto birthday wishes, festival greetings, referral rewards, review requests — sab automated.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-primary text-white shadow-glow' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* BIRTHDAYS */}
      {tab === 'birthdays' && (
        <div className="space-y-4">
          <div className="card p-5 bg-gradient-to-br from-rose-50 to-peach-50 border-rose-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-peach-500 grid place-items-center shrink-0">
                <Cake className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">Auto birthday wishes enabled</div>
                <div className="text-xs text-slate-600 mt-1">
                  Roz subah 9 AM pe AI generated wishes bhejta hai. Manual kuch nahi karna.
                </div>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200/80 bg-slate-50/60">
              <div className="font-bold text-sm">Upcoming (next 30 days)</div>
            </div>
            <div className="divide-y divide-slate-100">
              {upcoming?.upcoming?.map((c: any) => (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/60">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-mint grid place-items-center text-white text-xs font-bold shrink-0">
                    {(c.name || c.phone).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{c.name || c.phone}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                      {c.birthday && <span className="flex items-center gap-1"><Cake className="w-3 h-3" /> {new Date(c.birthday).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                      {c.anniversary && <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {new Date(c.anniversary).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[11px] font-bold text-peach-600 bg-peach-50 rounded-full px-2 py-1">
                      {c.days_until}d away
                    </span>
                    <button
                      onClick={() => previewGreeting(c, c.birthday ? 'birthday' : 'anniversary')}
                      className="btn-secondary py-1.5 px-3 text-xs"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              ))}
              {!upcoming?.upcoming?.length && (
                <div className="py-12 text-center text-sm text-slate-400">
                  <Cake className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Koi birthday/anniversary upcoming nahi. Contacts me dates add karo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GREETING LOG */}
      {tab === 'greetings' && (
        <div className="card overflow-hidden">
          <div className="divide-y divide-slate-100">
            {greetings?.greetings?.map((g: any) => (
              <div key={g.id} className="px-5 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`badge ${
                    g.greeting_type === 'birthday' ? 'badge-peach' :
                    g.greeting_type === 'festival' ? 'badge-mint' : 'badge-blue'
                  }`}>
                    {g.greeting_type === 'birthday' ? '🎂' : g.greeting_type === 'festival' ? '🎉' : '💍'} {g.greeting_type}
                    {g.festival_name && ` · ${g.festival_name}`}
                  </span>
                  <span className="text-xs text-slate-500">{g.contact_name || g.contact_phone}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {new Date(g.sent_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{g.message}</p>
              </div>
            ))}
            {!greetings?.greetings?.length && (
              <div className="py-12 text-center text-sm text-slate-400">Abhi tak koi greeting nahi bheja</div>
            )}
          </div>
        </div>
      )}

      {/* REFERRALS */}
      {tab === 'referrals' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Total referrals', value: referrals?.referrals?.length ?? 0, color: 'text-primary' },
              { label: 'Converted', value: referrals?.referrals?.filter((r: any) => r.status === 'converted').length ?? 0, color: 'text-mint-600' },
              { label: 'Pending', value: referrals?.referrals?.filter((r: any) => r.status === 'pending').length ?? 0, color: 'text-peach-600' },
            ].map((s) => (
              <div key={s.label} className="card p-5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</div>
                <div className={`mt-2 text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-100">
              {referrals?.referrals?.map((r: any) => (
                <div key={r.id} className="px-5 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-peach to-rose grid place-items-center text-white text-xs font-bold shrink-0">
                    {(r.referrer_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{r.referrer_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{r.referral_code}</div>
                  </div>
                  <span className={`badge ${
                    r.status === 'converted' ? 'badge-mint' :
                    r.status === 'signed_up' ? 'badge-blue' : 'badge-slate'
                  }`}>{r.status}</span>
                </div>
              ))}
              {!referrals?.referrals?.length && (
                <div className="py-12 text-center text-sm text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Abhi tak koi referral nahi
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOYALTY */}
      {tab === 'loyalty' && (
        <div className="card overflow-hidden">
          <div className="divide-y divide-slate-100">
            {loyalty?.loyalty?.map((c: any, i: number) => (
              <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' :
                  i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                  i === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-white' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {i < 3 ? <Trophy className="w-4 h-4" /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{c.name || c.phone}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{c.phone}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-extrabold text-primary">{c.loyalty_points}</div>
                  <div className="text-[10px] text-slate-400">points</div>
                </div>
                <button onClick={() => generateReferral(c)} disabled={busy} className="btn-secondary py-1.5 px-3 text-xs shrink-0">
                  <Copy className="w-3 h-3" /> Code
                </button>
              </div>
            ))}
            {!loyalty?.loyalty?.length && (
              <div className="py-12 text-center text-sm text-slate-400">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Koi loyalty points nahi. Referral se points milenge.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {selectedContact && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelectedContact(null); setPreview(''); }}
              className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-md bg-white rounded-2xl shadow-lift p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="font-bold">AI Greeting Preview</div>
                <button onClick={() => { setSelectedContact(null); setPreview(''); }} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-slate-500 mb-3">
                To: <b className="text-ink">{selectedContact.name || selectedContact.phone}</b>
              </div>
              <div className="rounded-xl bg-mint-50 border border-mint-100 p-4 text-sm whitespace-pre-wrap">
                {preview}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Ye roz 9 AM pe automatic bhej diya jayega. Manual approval nahi chahiye.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
