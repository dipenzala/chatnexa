'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Loader2, Check, AlertCircle, Wallet, Key, Bot, Phone, Users, Plus } from 'lucide-react';
import { api } from '@/lib/api';

export default function Settings() {
  const { data: org, mutate } = useSWR<any>('/api/v1/org', api.get);
  const { data: wallet, mutate: mutateWallet } = useSWR<any>('/api/v1/org/wallet', api.get);
  const { data: team, mutate: mutateTeam } = useSWR<any>('/api/v1/auth/team', api.get);
  const { data: keys, mutate: mutateKeys } = useSWR<any>('/api/v1/org/api-keys', api.get);

  const [tab, setTab] = useState<'whatsapp' | 'wallet' | 'ai' | 'team' | 'api'>('whatsapp');
  const [wa, setWa] = useState({ phoneNumberId: '', accessToken: '', businessId: '' });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [topup, setTopup] = useState('500');
  const [member, setMember] = useState({ email: '', name: '', password: '', role: 'agent' });
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    if (org?.organization) { setAiPrompt(org.organization.ai_system_prompt || ''); setAiEnabled(org.organization.ai_enabled); }
  }, [org]);

  function flash(type: 'ok' | 'err', text: string) { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); }

  async function connectWa(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { const res = await api.post('/api/v1/org/whatsapp/connect', wa); flash('ok', `Connected: ${res.verified_name || res.display_phone_number}`); mutate(); setWa({ phoneNumberId: '', accessToken: '', businessId: '' }); }
    catch (err: any) { flash('err', err.message); }
    finally { setBusy(false); }
  }

  async function saveAi(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api.patch('/api/v1/org', { ai_system_prompt: aiPrompt, ai_enabled: aiEnabled }); flash('ok', 'AI settings saved'); mutate(); }
    catch (err: any) { flash('err', err.message); }
    finally { setBusy(false); }
  }

  async function doTopup(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api.post('/api/v1/org/wallet/topup', { amount: Number(topup), reference: 'manual_test' }); flash('ok', `Wallet topped up by ₹${topup}`); mutateWallet(); mutate(); }
    catch (err: any) { flash('err', err.message); }
    finally { setBusy(false); }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api.post('/api/v1/auth/team', member); flash('ok', 'Team member added'); setMember({ email: '', name: '', password: '', role: 'agent' }); mutateTeam(); }
    catch (err: any) { flash('err', err.message); }
    finally { setBusy(false); }
  }

  async function createKey() {
    try { const res = await api.post('/api/v1/org/api-keys', { name: 'dashboard' }); setNewKey(res.key); mutateKeys(); }
    catch (err: any) { flash('err', err.message); }
  }

  const o = org?.organization;
  const TABS = [
    { id: 'whatsapp', label: 'WhatsApp', icon: Phone },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'ai', label: 'AI', icon: Bot },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'api', label: 'API Keys', icon: Key },
  ] as const;

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${msg.type === 'ok' ? 'bg-mint-50 border border-mint-100 text-mint-600' : 'bg-rose-50 border border-rose-100 text-rose-600'}`}>
          {msg.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msg.text}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-primary text-white shadow-glow' : 'text-slate-600 hover:bg-slate-100'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'whatsapp' && (
        <div className="card p-6 max-w-2xl">
          <h3 className="font-bold text-lg">WhatsApp Business connection</h3>
          <p className="text-sm text-slate-500 mt-1">Connect your Meta WhatsApp Cloud API number.</p>
          {o?.wa_connected && (
            <div className="mt-4 rounded-xl bg-mint-50 border border-mint-100 p-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-mint-600 shrink-0" />
              <div className="text-sm">
                <div className="font-bold text-mint-600">Connected</div>
                <div className="text-xs text-slate-600 font-mono mt-0.5">Phone Number ID: {o.wa_phone_number_id}</div>
              </div>
            </div>
          )}
          <form onSubmit={connectWa} className="mt-5 space-y-4">
            <div><label className="label">Phone Number ID</label><input required value={wa.phoneNumberId} onChange={(e) => setWa({ ...wa, phoneNumberId: e.target.value })} placeholder="123456789012345" className="input font-mono" /></div>
            <div>
              <label className="label">Permanent Access Token</label>
              <textarea required rows={3} value={wa.accessToken} onChange={(e) => setWa({ ...wa, accessToken: e.target.value })} placeholder="EAAxxxxxxx…" className="input font-mono text-xs resize-none" />
              <p className="mt-1.5 text-[11px] text-slate-500">Stored encrypted with AES-256-GCM.</p>
            </div>
            <div><label className="label">WhatsApp Business Account ID (optional)</label><input value={wa.businessId} onChange={(e) => setWa({ ...wa, businessId: e.target.value })} className="input font-mono" /></div>
            <div className="rounded-xl bg-primary-50 border border-primary-100 p-3.5 text-xs text-primary-700">
              <b>Webhook URL:</b> <code className="font-mono">{process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks/whatsapp</code>
              <br /><b>Verify token:</b> <code className="font-mono">chatnexa_verify_token</code>
            </div>
            <button type="submit" disabled={busy} className="btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Validate & connect</button>
          </form>
        </div>
      )}

      {tab === 'wallet' && (
        <div className="grid gap-5 lg:grid-cols-2 max-w-5xl">
          <div className="card p-6">
            <h3 className="font-bold text-lg">Wallet</h3>
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-primary to-mint p-6 text-white">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Available balance</div>
              <div className="mt-1 text-4xl font-extrabold tracking-tight">₹{Number(wallet?.balance ?? 0).toFixed(2)}</div>
            </div>
            <form onSubmit={doTopup} className="mt-5 space-y-3">
              <div><label className="label">Add funds (₹)</label><input type="number" min="100" value={topup} onChange={(e) => setTopup(e.target.value)} className="input" /></div>
              <button type="submit" disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Top up wallet</button>
              <p className="text-[11px] text-slate-500 text-center">In production this opens Razorpay checkout.</p>
            </form>
            <div className="mt-5 pt-5 border-t border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3"><div className="font-semibold text-slate-500">Marketing</div><div className="mt-1 font-extrabold text-ink">₹0.88 / msg</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="font-semibold text-slate-500">Utility</div><div className="mt-1 font-extrabold text-ink">₹0.12 / msg</div></div>
            </div>
          </div>
          <div className="card p-6">
            <h3 className="font-bold text-lg">Recent transactions</h3>
            <div className="mt-4 space-y-2 max-h-[420px] overflow-y-auto">
              {wallet?.ledger?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.description || t.category}</div>
                    <div className="text-[11px] text-slate-500">{new Date(t.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className={`text-sm font-extrabold shrink-0 ml-3 ${t.type === 'credit' ? 'text-mint-600' : 'text-rose'}`}>
                    {t.type === 'credit' ? '+' : '−'}₹{Number(t.amount).toFixed(2)}
                  </div>
                </div>
              ))}
              {!wallet?.ledger?.length && <p className="text-sm text-slate-400 py-6 text-center">No transactions yet</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <div className="card p-6 max-w-2xl">
          <h3 className="font-bold text-lg">AI assistant</h3>
          <p className="text-sm text-slate-500 mt-1">AI answers inbound messages from your knowledge base.</p>
          <form onSubmit={saveAi} className="mt-5 space-y-4">
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} className="rounded w-4 h-4" />
              <div>
                <div className="font-semibold text-sm">Enable AI auto-reply</div>
                <div className="text-xs text-slate-500">Replies automatically 24/7</div>
              </div>
            </label>
            <div>
              <label className="label">System prompt / persona</label>
              <textarea rows={7} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className="input resize-none text-xs" />
            </div>
            <button type="submit" disabled={busy} className="btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save AI settings</button>
          </form>
        </div>
      )}

      {tab === 'team' && (
        <div className="grid gap-5 lg:grid-cols-2 max-w-5xl">
          <div className="card p-6">
            <h3 className="font-bold text-lg">Invite teammate</h3>
            <form onSubmit={addMember} className="mt-4 space-y-4">
              <div><label className="label">Name</label><input required value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} className="input" /></div>
              <div><label className="label">Email</label><input type="email" required value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} className="input" /></div>
              <div><label className="label">Temporary password</label><input type="password" required minLength={8} value={member.password} onChange={(e) => setMember({ ...member, password: e.target.value })} className="input" /></div>
              <div>
                <label className="label">Role</label>
                <select value={member.role} onChange={(e) => setMember({ ...member, role: e.target.value })} className="input">
                  <option value="agent">Agent — inbox only</option>
                  <option value="admin">Admin — full access</option>
                </select>
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Add member</button>
            </form>
          </div>
          <div className="card p-6">
            <h3 className="font-bold text-lg">Team members</h3>
            <div className="mt-4 space-y-2">
              {team?.members?.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-mint grid place-items-center text-white text-xs font-bold shrink-0">{(m.name || m.email).charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{m.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{m.email}</div>
                  </div>
                  <span className="badge-blue">{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'api' && (
        <div className="card p-6 max-w-2xl">
          <h3 className="font-bold text-lg">API keys</h3>
          <p className="text-sm text-slate-500 mt-1">Use these to send messages from your backend.</p>
          {newKey && (
            <div className="mt-4 rounded-xl bg-peach-50 border border-peach-100 p-4">
              <div className="text-xs font-bold text-peach-600 mb-1.5">⚠️ Copy this key now — it won't be shown again</div>
              <code className="block text-xs font-mono break-all bg-white rounded-lg p-3 border border-peach-100">{newKey}</code>
            </div>
          )}
          <button onClick={createKey} className="btn-primary mt-5"><Plus className="w-4 h-4" /> Generate new key</button>
          <div className="mt-5 space-y-2">
            {keys?.keys?.map((k: any) => (
              <div key={k.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-sm font-mono font-semibold">{k.key_prefix}••••••••</div>
                  <div className="text-[11px] text-slate-500">Created {new Date(k.created_at).toLocaleDateString('en-IN')}{k.revoked && ' · revoked'}</div>
                </div>
                {k.revoked ? <span className="badge-rose">revoked</span> : <span className="badge-mint">active</span>}
              </div>
            ))}
            {!keys?.keys?.length && <p className="text-sm text-slate-400 py-6 text-center">No API keys yet</p>}
          </div>
        </div>
      )}
    </div>
  );
}
