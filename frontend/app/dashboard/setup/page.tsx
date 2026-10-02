'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Check, ChevronRight, ChevronLeft, Loader2, Copy,
  ExternalLink, AlertCircle, CheckCircle2, XCircle, Send, RefreshCw,
  Key, Phone, Globe, Shield, Zap, Server, PartyPopper, Info,
} from 'lucide-react';
import { api } from '@/lib/api';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface SetupStatus {
  connected: boolean;
  hasCredentials: boolean;
  hasWabaId: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  live?: any;
  subscriptions?: any[];
  templateCount: number;
  webhookUrl: string;
  verifyToken: string;
}

export default function SetupPage() {
  const { data: status, mutate } = useSWR<SetupStatus>('/api/v1/org/whatsapp/setup-status', api.get);
  const [step, setStep] = useState<Step>(1);

  // Form state
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [verifyInfo, setVerifyInfo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  // Auto-advance based on status
  useEffect(() => {
    if (!status) return;
    if (status.connected && status.live) setStep(7);
    else if (status.hasCredentials && status.hasWabaId) setStep(6);
    else if (status.hasCredentials) setStep(5);
  }, [status]);

  function flash(msg: string) { setError(msg); setTimeout(() => setError(''), 5000); }

  async function verifyCreds() {
    if (!phoneNumberId || !accessToken) return flash('Both fields required');
    setBusy(true); setError('');
    try {
      const res = await api.post('/api/v1/org/whatsapp/verify-token', { phoneNumberId, accessToken });
      if (res.verified) {
        setVerifyInfo(res.info);
        setStep(5);
      } else {
        flash(res.error || 'Verification failed');
      }
    } catch (e: any) { flash(e.message); }
    finally { setBusy(false); }
  }

  async function connect() {
    setBusy(true); setError('');
    try {
      const res = await api.post('/api/v1/org/whatsapp/connect-v2', {
        phoneNumberId, accessToken, businessId: wabaId || undefined, autoSubscribe: true,
      });
      if (!wabaId && res.wabaId) setWabaId(res.wabaId);
      await mutate();
      setStep(6);
    } catch (e: any) { flash(e.message); }
    finally { setBusy(false); }
  }

  async function subscribeWebhook() {
    setBusy(true); setError('');
    try {
      await api.post('/api/v1/org/whatsapp/subscribe-webhook', {});
      await mutate();
      setStep(7);
    } catch (e: any) { flash(e.message); }
    finally { setBusy(false); }
  }

  async function sendTest() {
    if (!testNumber) return flash('Enter a phone number');
    setTestStatus('sending'); setError('');
    try {
      await api.post('/api/v1/org/whatsapp/send-test', { to: testNumber });
      setTestStatus('sent');
    } catch (e: any) {
      setTestStatus('failed');
      flash(e.message);
    }
  }

  async function syncTemplates() {
    setBusy(true); setError('');
    try {
      const res = await api.post('/api/v1/org/whatsapp/sync-templates', {});
      alert(`✅ Synced ${res.synced} templates from Meta`);
      await mutate();
    } catch (e: any) { flash(e.message); }
    finally { setBusy(false); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    alert('Copied!');
  }

  const STEPS = [
    { n: 1, title: 'Welcome', icon: PartyPopper },
    { n: 2, title: 'Meta Business', icon: Globe },
    { n: 3, title: 'Create App', icon: Key },
    { n: 4, title: 'Credentials', icon: Shield },
    { n: 5, title: 'Connect', icon: Zap },
    { n: 6, title: 'Webhook', icon: Server },
    { n: 7, title: 'Test', icon: Send },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">WhatsApp API Setup</h1>
          <p className="text-sm text-slate-500 mt-1">Connect your WhatsApp Business number in 7 steps</p>
        </div>
        {status?.connected && (
          <span className="badge-mint inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s, i) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <div key={s.n} className="flex items-center gap-1 flex-1">
                <button
                  onClick={() => setStep(s.n as Step)}
                  className={`flex items-center gap-2 shrink-0 transition-all ${
                    active ? 'text-primary' : done ? 'text-mint-600' : 'text-slate-400'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${
                    active ? 'bg-primary text-white shadow-glow' :
                    done ? 'bg-mint text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {done ? <Check className="w-4 h-4" /> : s.n}
                  </span>
                  <span className="hidden md:block text-xs font-semibold">{s.title}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${done ? 'bg-mint' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm px-4 py-3 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >

          {/* STEP 1 — WELCOME */}
          {step === 1 && (
            <div className="card p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#1E5EE8] grid place-items-center mx-auto shadow-lg">
                <MessageSquare className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="mt-5 text-2xl font-bold">Get your WhatsApp Business API</h2>
              <p className="mt-3 text-slate-600 max-w-lg mx-auto">
                Ye wizard aapko step-by-step guide karega. Total time: <b>10 minutes</b>.
                Kuch bhi technical nahi hai — hum aapko har step pe screenshots ke saath bataenge.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
                {[
                  { icon: Globe, t: 'Meta Business', d: 'Aapko existing ya naya Meta Business account chahiye' },
                  { icon: Phone, t: 'Phone Number', d: 'Ek phone number jo WhatsApp pe registered na ho' },
                  { icon: Key, t: 'Facebook App', d: 'Hum aapko guide karenge — 5 minute ka kaam' },
                ].map((r) => (
                  <div key={r.t} className="rounded-xl bg-slate-50 p-4">
                    <r.icon className="w-5 h-5 text-primary mb-2" />
                    <div className="font-bold text-sm">{r.t}</div>
                    <div className="text-xs text-slate-500 mt-1">{r.d}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-center gap-3">
                <button onClick={() => setStep(2)} className="btn-primary px-6 py-3">
                  Start setup <ChevronRight className="w-4 h-4" />
                </button>
                {status?.connected && (
                  <Link href="/dashboard/inbox" className="btn-secondary px-6 py-3">
                    Already connected? Go to inbox
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* STEP 2 — META BUSINESS */}
          {step === 2 && (
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 grid place-items-center">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Step 2 — Meta Business Account</h2>
                  <p className="text-sm text-slate-500">Business.facebook.com pe account banao (free)</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-700">
                      Agar aapke paas already Meta Business Manager hai (Facebook Page chalate ho), to ye step skip karo.
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">1</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">Business.facebook.com kholo</div>
                      <div className="text-xs text-slate-500 mt-1">Facebook login se sign in karo</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">2</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">Business account banao</div>
                      <div className="text-xs text-slate-500 mt-1">Business name, your name, business email daalo</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">3</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">WhatsApp Business Account add karo</div>
                      <div className="text-xs text-slate-500 mt-1">Business Settings → Accounts → WhatsApp Accounts → Add</div>
                    </div>
                  </div>
                </div>

                <a
                  href="https://business.facebook.com/overview"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary w-full py-3 inline-flex items-center justify-center"
                >
                  Open Meta Business <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(1)} className="btn-ghost">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={() => setStep(3)} className="btn-primary">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — CREATE APP */}
          {step === 3 && (
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 grid place-items-center">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Step 3 — Create Facebook App</h2>
                  <p className="text-sm text-slate-500">Isse aapko Access Token milega</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">1</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">developers.facebook.com/apps kholo</div>
                      <div className="text-xs text-slate-500 mt-1">"Create App" click karo</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">2</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">App type: "Business"</div>
                      <div className="text-xs text-slate-500 mt-1">App name: ChatNexa-WhatsApp (ya jo bhi aap chaho)</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">3</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">WhatsApp product add karo</div>
                      <div className="text-xs text-slate-500 mt-1">Dashboard → Add Product → WhatsApp → Setup</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">4</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">API Setup → copy credentials</div>
                      <div className="text-xs text-slate-500 mt-1">Phone Number ID + Permanent Access Token — dono chahiye</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-700">
                      <b>Important:</b> Temporary token ki jagah <b>Permanent Token</b> lo.
                      Meta Business Settings → System Users → Generate Token se milega.
                    </div>
                  </div>
                </div>

                <a
                  href="https://developers.facebook.com/apps"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary w-full py-3 inline-flex items-center justify-center"
                >
                  Open Facebook Developers <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(2)} className="btn-ghost">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={() => setStep(4)} className="btn-primary">
                  I have credentials <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — CREDENTIALS */}
          {step === 4 && (
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 grid place-items-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Step 4 — Paste your credentials</h2>
                  <p className="text-sm text-slate-500">Yeh credentials encrypted save honge (AES-256)</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Phone Number ID</label>
                  <input
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value.trim())}
                    placeholder="123456789012345"
                    className="input font-mono"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">Meta → WhatsApp → API Setup → "Phone number ID"</p>
                </div>

                <div>
                  <label className="label">Permanent Access Token</label>
                  <textarea
                    rows={3}
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value.trim())}
                    placeholder="EAAxxxxxxxxxxxxxxxxxxx…"
                    className="input font-mono text-xs resize-none"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">Meta Business Settings → System Users → Generate Token</p>
                </div>

                <div>
                  <label className="label">WhatsApp Business Account ID (optional)</label>
                  <input
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value.trim())}
                    placeholder="Auto-detect hoga agar blank chhoda"
                    className="input font-mono"
                  />
                </div>

                <button
                  onClick={verifyCreds}
                  disabled={busy || !phoneNumberId || !accessToken}
                  className="btn-primary w-full py-3"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Verify with Meta
                </button>

                {verifyInfo && (
                  <div className="rounded-xl bg-mint-50 border border-mint-100 p-4">
                    <div className="flex items-center gap-2 text-mint-700 font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Credentials verified
                    </div>
                    <div className="mt-2 text-xs text-slate-600 space-y-1 font-mono">
                      <div>Number: {verifyInfo.display_phone_number}</div>
                      <div>Name: {verifyInfo.verified_name}</div>
                      <div>Quality: {verifyInfo.quality_rating || 'N/A'}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(3)} className="btn-ghost">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              </div>
            </div>
          )}

          {/* STEP 5 — CONNECT */}
          {step === 5 && (
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-mint to-emerald-600 grid place-items-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Step 5 — Save & connect</h2>
                  <p className="text-sm text-slate-500">Credentials verified — ab save karte hain</p>
                </div>
              </div>

              {verifyInfo && (
                <div className="rounded-xl bg-slate-50 p-4 mb-5 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Phone</span><span className="font-mono font-semibold">{verifyInfo.display_phone_number}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Business Name</span><span className="font-semibold">{verifyInfo.verified_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Quality</span><span className="badge-mint">{verifyInfo.quality_rating || 'N/A'}</span></div>
                </div>
              )}

              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-5">
                <div className="text-sm font-semibold text-primary mb-1">Hum ye karenge:</div>
                <ul className="text-xs text-slate-700 space-y-1 ml-4 list-disc">
                  <li>Aapke credentials encrypted save karenge</li>
                  <li>WhatsApp Business Account ID auto-detect karenge</li>
                  <li>Aapke app ko WABA pe subscribe karenge (webhooks ke liye)</li>
                </ul>
              </div>

              <button onClick={connect} disabled={busy} className="btn-primary w-full py-3">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {busy ? 'Connecting…' : 'Connect WhatsApp'}
              </button>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(4)} className="btn-ghost">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              </div>
            </div>
          )}

          {/* STEP 6 — WEBHOOK */}
          {step === 6 && (
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 grid place-items-center">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Step 6 — Webhook configuration</h2>
                  <p className="text-sm text-slate-500">Inbound messages receive karne ke liye</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Callback URL (paste in Meta)</div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={status?.webhookUrl || 'Loading…'}
                      className="input font-mono text-xs flex-1"
                    />
                    <button
                      onClick={() => copyToClipboard(status?.webhookUrl || '')}
                      className="btn-secondary px-3"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Verify Token</div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={status?.verifyToken || 'Loading…'}
                      className="input font-mono text-xs flex-1"
                    />
                    <button
                      onClick={() => copyToClipboard(status?.verifyToken || '')}
                      className="btn-secondary px-3"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                  <div className="text-sm font-semibold text-primary mb-2">Meta me configure karo:</div>
                  <ol className="text-xs text-slate-700 space-y-1 ml-4 list-decimal">
                    <li>Meta App Dashboard → WhatsApp → Configuration</li>
                    <li>Callback URL paste karo + Verify Token</li>
                    <li>"Verify and save" click karo</li>
                    <li>Webhook fields me "messages" subscribe karo</li>
                  </ol>
                </div>

                <button onClick={subscribeWebhook} disabled={busy} className="btn-primary w-full py-3">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {busy ? 'Confirming…' : 'I have configured webhook — Continue'}
                </button>
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(5)} className="btn-ghost">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              </div>
            </div>
          )}

          {/* STEP 7 — TEST & DONE */}
          {step === 7 && (
            <div className="card p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-mint to-emerald-600 grid place-items-center mx-auto shadow-lg">
                  <PartyPopper className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
                <h2 className="mt-4 text-2xl font-bold">WhatsApp API connected! 🎉</h2>
                <p className="text-sm text-slate-500 mt-2">
                  {status?.live?.display_phone_number && `Number: ${status.live.display_phone_number}`}
                </p>
              </div>

              {/* Status cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="rounded-xl bg-mint-50 border border-mint-100 p-3 text-center">
                  <CheckCircle2 className="w-5 h-5 text-mint-600 mx-auto mb-1" />
                  <div className="text-[11px] font-bold text-mint-700">Connected</div>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
                  <Server className="w-5 h-5 text-primary mx-auto mb-1" />
                  <div className="text-[11px] font-bold text-primary">
                    {status?.subscriptions?.length ? 'Webhook OK' : 'Webhook pending'}
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                  <Zap className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                  <div className="text-[11px] font-bold text-amber-700">{status?.templateCount || 0} templates</div>
                </div>
                <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 text-center">
                  <Shield className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <div className="text-[11px] font-bold text-purple-700">
                    {status?.live?.quality_rating || 'Quality N/A'}
                  </div>
                </div>
              </div>

              {/* Send test */}
              <div className="rounded-xl border border-slate-200 p-5 mb-5">
                <div className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" /> Send a test message
                </div>
                <div className="flex gap-2">
                  <input
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    placeholder="919876543210"
                    className="input flex-1 font-mono"
                  />
                  <button
                    onClick={sendTest}
                    disabled={testStatus === 'sending'}
                    className="btn-primary px-5"
                  >
                    {testStatus === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                {testStatus === 'sent' && (
                  <div className="mt-3 text-xs text-mint-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Message sent! Check your WhatsApp.
                  </div>
                )}
                {testStatus === 'failed' && (
                  <div className="mt-3 text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Failed to send — check number format
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={syncTemplates} disabled={busy} className="btn-secondary py-3">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sync templates from Meta
                </button>
                <Link href="/dashboard" className="btn-primary py-3 inline-flex items-center justify-center gap-2">
                  Go to Dashboard <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="mt-6 flex justify-between">
                <button onClick={() => setStep(6)} className="btn-ghost">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
