'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Send, Loader2, CheckCircle2, XCircle, ArrowLeft, Phone,
  Shield, Activity, Zap, Copy, RefreshCw, Clock, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function WATestPage() {
  const { data: details, mutate: mutateDetails } = useSWR('/api/v1/test-number/whatsapp-details', api.get, { refreshInterval: 30000 });
  const { data: log, mutate: mutateLog } = useSWR('/api/v1/test-number/log', api.get, { refreshInterval: 10000 });
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('🎉 ChatNexa test message — WhatsApp API working!');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function sendTest() {
    if (phone.length < 10) return setError('Enter valid phone with country code (e.g. 919999999999)');
    setBusy(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/api/v1/test-number/send', { phone, message });
      setSuccess(`Test message sent! ID: ${res.messageId?.slice(0, 20)}...`);
      mutateLog(); mutateDetails();
      setPhone('');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  const statusIcon = (s: string) => {
    if (s === 'delivered' || s === 'read') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (s === 'sent') return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    if (s === 'failed') return <XCircle className="w-4 h-4 text-rose-500" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Link href="/dashboard/setup" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Back to Setup
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Phone className="w-6 h-6 text-emerald-500" /> WhatsApp API — Live Test
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Send real messages to verify your WhatsApp Business API
        </p>
      </div>

      {/* Connection Status */}
      <div className={`rounded-2xl p-5 border-2 ${details?.connected ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 ${details?.connected ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg">
              {details?.connected ? '✅ WhatsApp Connected' : '⚠️ WhatsApp Not Connected'}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {details?.connected ? 'Ready to send messages' : 'Complete Setup Wizard first'}
            </div>

            {details?.connected && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Provider</div>
                  <div className="text-sm font-bold mt-0.5">{details.bspProvider === 'direct' ? 'Meta Cloud API' : '360Dialog'}</div>
                </div>
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Phone</div>
                  <div className="text-sm font-bold mt-0.5">{details.live?.display_phone_number || details.displayPhone || '—'}</div>
                </div>
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Name</div>
                  <div className="text-sm font-bold mt-0.5 truncate">{details.live?.verified_name || details.verifiedName || '—'}</div>
                </div>
                <div className="rounded-xl bg-white/60 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Quality</div>
                  <div className="text-sm font-bold mt-0.5">{details.quality || 'N/A'}</div>
                </div>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button onClick={() => mutateDetails()} className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Send Test Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="font-bold text-lg mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-emerald-500" /> Send Test Message
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Recipient Phone Number (with country code)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="919999999999"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              maxLength={15}
            />
            <p className="mt-1.5 text-[11px] text-slate-500">India = 91 + 10-digit. Example: 919876543210</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>

          <button onClick={sendTest} disabled={busy || !details?.connected} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 font-semibold disabled:opacity-50 transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {busy ? 'Sending...' : 'Send Test Message'}
          </button>
        </div>
      </div>

      {/* Test Log */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" /> Test History
          </div>
          <span className="text-xs text-slate-500">{log?.log?.length || 0} tests</span>
        </div>

        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {log?.log?.map((l: any) => (
            <div key={l.id} className="p-4 flex items-center gap-3">
              {statusIcon(l.status)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{l.phone_number}</span>
                  <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                    l.status === 'delivered' || l.status === 'read' ? 'bg-emerald-100 text-emerald-700' :
                    l.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                    l.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                  }`}>{l.status}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {new Date(l.sent_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                {l.error && <div className="text-[11px] text-rose-500 mt-0.5 truncate">{l.error}</div>}
              </div>
              {l.message_id && (
                <button onClick={() => navigator.clipboard.writeText(l.message_id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {!log?.log?.length && (
            <div className="py-12 text-center text-sm text-slate-400">
              No test messages yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
