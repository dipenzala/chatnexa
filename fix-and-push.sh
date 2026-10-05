#!/usr/bin/env bash
set +e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; M='\033[0;35m'; N='\033[0m'

cd ~/OneDrive/Desktop/chatnexa/chatnexa
PD=$(pwd)

echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}║  🚀 FIX WA-TEST PAGE + PUSH TO VERCEL                ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════╝${N}"
echo ""

# ============================================================
# [1] CHECK IF wa-test PAGE EXISTS LOCALLY
# ============================================================
echo -e "${B}[1/5] Checking wa-test page...${N}"

if [ -f "frontend/app/dashboard/wa-test/page.tsx" ]; then
  echo -e "${G}  ✅ Page exists locally${N}"
  LINES=$(wc -l < frontend/app/dashboard/wa-test/page.tsx)
  echo -e "${C}  Lines: $LINES${N}"
else
  echo -e "${Y}  ⚠️  Page missing — creating...${N}"
  mkdir -p frontend/app/dashboard/wa-test

  cat > frontend/app/dashboard/wa-test/page.tsx << 'WA_TEST_END'
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
WA_TEST_END
  echo -e "${G}  ✅ Page created${N}"
fi

# ============================================================
# [2] VERIFY OTHER CRITICAL PAGES EXIST
# ============================================================
echo ""
echo -e "${B}[2/5] Verifying critical pages...${N}"

PAGES=(
  "frontend/app/dashboard/page.tsx:Dashboard"
  "frontend/app/dashboard/inbox/page.tsx:Inbox"
  "frontend/app/dashboard/setup/page.tsx:Setup"
  "frontend/app/dashboard/wa-test/page.tsx:WA Test"
  "frontend/app/dashboard/ai-templates/page.tsx:AI Templates"
  "frontend/app/dashboard/mega/page.tsx:Mega Hub"
)

for entry in "${PAGES[@]}"; do
  p="${entry%%:*}"
  n="${entry##*:}"
  if [ -f "$p" ]; then
    echo -e "${G}    ✅ $n${N}"
  else
    echo -e "${R}    ❌ $n MISSING${N}"
  fi
done

# ============================================================
# [3] VERIFY BACKEND HAS test-number ROUTE
# ============================================================
echo ""
echo -e "${B}[3/5] Verifying backend test-number route...${N}"

if [ -f "backend/src/routes/test-number.ts" ]; then
  echo -e "${G}  ✅ test-number.ts exists${N}"
else
  echo -e "${R}  ❌ test-number.ts MISSING${N}"
fi

if grep -q "test-number" backend/src/routes/index.ts 2>/dev/null; then
  echo -e "${G}  ✅ Registered in index.ts${N}"
else
  echo -e "${R}  ❌ Not registered${N}"
fi

# ============================================================
# [4] GIT COMMIT + PUSH
# ============================================================
echo ""
echo -e "${B}[4/5] Git commit + push to GitHub...${N}"

# Clean
rm -rf .backup-* .broken-* .page-backup-* 2>/dev/null || true

# Ensure gitignore
cat > .gitignore << 'GI_END'
node_modules/
.next/
dist/
.env
.env.local
.env.*.local
backend/.env
frontend/.env.local
*.log
.DS_Store
.backup-*
.broken-*
.page-backup-*
*.bak
coverage/
GI_END

# Init git if needed
if [ ! -d .git ]; then
  git init
  git branch -M main
fi

# Remote check
REMOTE=$(git remote -v 2>/dev/null | grep origin | head -1)
if [ -z "$REMOTE" ]; then
  echo -e "${Y}  ⚠️  No GitHub remote. Run:${N}"
  echo -e "${Y}    git remote add origin https://github.com/dipenzala/chatnexa.git${N}"
  echo -e "${Y}  Then rerun this script${N}"
else
  echo -e "${C}  Remote: $REMOTE${N}"
fi

# Stage
git add -A 2>&1 | tail -1

# Verify no env files staged
if git status --short 2>/dev/null | grep -q "\.env"; then
  echo -e "${Y}  ⚠️  Env file detected — unstaging${N}"
  git reset backend/.env frontend/.env.local 2>/dev/null || true
fi

# Commit
STAGED=$(git diff --cached --numstat 2>/dev/null | wc -l)
echo -e "${C}  Files staged: $STAGED${N}"

if [ "$STAGED" -gt 0 ]; then
  git commit -m "feat: add WA test page + WhatsApp setup routes [$(date '+%Y-%m-%d %H:%M')]" 2>&1 | tail -3
fi

# Push
if [ -n "$REMOTE" ]; then
  echo ""
  echo -e "${C}  Pushing to GitHub...${N}"
  PUSH_OUT=$(git push origin main 2>&1)
  PUSH_STATUS=$?
  echo "$PUSH_OUT" | tail -5

  if [ "$PUSH_STATUS" -eq 0 ]; then
    echo -e "${G}  ✅ Pushed successfully!${N}"
    echo -e "${G}  → Vercel will auto-redeploy in 2-3 minutes${N}"
  elif echo "$PUSH_OUT" | grep -q "Authentication"; then
    echo -e "${Y}  Auth required — use Personal Access Token${N}"
    echo -e "${Y}  https://github.com/settings/tokens → Generate (classic) → scope: repo${N}"
  elif echo "$PUSH_OUT" | grep -q "everything up-to-date"; then
    echo -e "${G}  ✅ Already up to date${N}"
  else
    echo -e "${Y}  Push output above${N}"
  fi
fi

# ============================================================
# [5] INSTRUCTIONS
# ============================================================
echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}║              ✅ DONE                                  ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════╝${N}"
echo ""
echo -e "${C}NEXT STEPS:${N}"
echo ""
echo -e "  ${Y}1.${N} Wait 2-3 minutes — Vercel auto-redeploys"
echo ""
echo -e "  ${Y}2.${N} Check deployment status:"
echo -e "     ${G}https://vercel.com/dashboard${N}"
echo -e "     → chatnexa → Deployments"
echo ""
echo -e "  ${Y}3.${N} Test the WA test page:"
echo -e "     ${G}https://chatnexa-nine.vercel.app/dashboard/wa-test${N}"
echo ""
echo -e "  ${Y}4.${N} ${R}Ctrl+Shift+R${N} (hard refresh in browser)"
echo ""
echo -e "  ${Y}5.${N} Send test message:"
echo -e "     → Phone number daalo (with 91)"
echo -e "     → Send Test Message click karo"
echo ""
echo -e "${M}  IMPORTANT FOR TEST MESSAGES:${N}"
echo -e "${M}  Meta test number ke liye, apna number Meta Dashboard me add karo:${N}"
echo -e "${M}  → WhatsApp → API Setup → 'To' field → Add recipient${N}"
echo ""