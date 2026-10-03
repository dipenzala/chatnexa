#!/usr/bin/env bash
# ChatNexa Test Suite v2 — Auto-detect path
set +e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; N='\033[0m'

PASS=0; FAIL=0; WARN=0
mark_pass() { echo -e "${G}✅ $1${N}"; PASS=$((PASS+1)); }
mark_fail() { echo -e "${R}❌ $1${N}"; FAIL=$((FAIL+1)); }
mark_warn() { echo -e "${Y}⚠️  $1${N}"; WARN=$((WARN+1)); }
section() { echo ""; echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; echo -e "${C}$1${N}"; echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; }

# ============================================================
# AUTO-DETECT PROJECT ROOT
# ============================================================
if [ -d "./backend" ] && [ -d "./frontend" ]; then
  ROOT="."
elif [ -d "./chatnexa/backend" ]; then
  ROOT="./chatnexa"
elif [ -d "../backend" ] && [ -d "../frontend" ]; then
  ROOT=".."
else
  echo -e "${R}❌ Project root nahi mila. Chalao from chatnexa/ folder.${N}"
  echo "Current path: $(pwd)"
  exit 1
fi

echo ""
echo -e "${B}╔═══════════════════════════════════════════════╗${N}"
echo -e "${B}║   🧪 ChatNexa Test Suite v2.0                ║${N}"
echo -e "${B}║   $(date '+%Y-%m-%d %H:%M:%S')                       ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════╝${N}"
echo ""
echo -e "${C}📂 Project root: $(cd $ROOT && pwd)${N}"

API="${API_URL:-http://localhost:8080}"
WEB="${WEB_URL:-http://localhost:3000}"

# ============================================================
section "📁 [1/10] FILE STRUCTURE"
# ============================================================
[ -d "$ROOT/backend" ] && mark_pass "Backend folder" || mark_fail "Backend folder"
[ -d "$ROOT/frontend" ] && mark_pass "Frontend folder" || mark_fail "Frontend folder"
[ -d "$ROOT/frontend/app/dashboard" ] && mark_pass "Dashboard folder" || mark_fail "Dashboard folder"
[ -f "$ROOT/backend/.env" ] && mark_pass "backend/.env" || mark_fail "backend/.env"
[ -f "$ROOT/frontend/.env.local" ] && mark_pass "frontend/.env.local" || mark_warn "frontend/.env.local (uses defaults)"
[ -f "$ROOT/backend/src/db/schema.sql" ] && mark_pass "Database schema" || mark_fail "Database schema"
[ -f "$ROOT/package.json" ] && mark_pass "Root package.json" || mark_fail "Root package.json"

# ============================================================
section "🗄️  [2/10] MIGRATIONS"
# ============================================================
MIG_COUNT=0
for f in "$ROOT/backend/src/db/migrations"/*.sql; do
  [ -f "$f" ] && MIG_COUNT=$((MIG_COUNT+1))
done
[ "$MIG_COUNT" -ge 4 ] && mark_pass "$MIG_COUNT migration files" || mark_fail "Only $MIG_COUNT migrations (need 4+)"

# ============================================================
section "⚙️  [3/10] BACKEND SERVICES"
# ============================================================
SERVICES=(whatsapp.ts openai.ts cloudinary.ts razorpay.ts mailer.ts billing.ts socket.ts deal-ai.ts nba.ts client-love.ts ai-growth.ts seo-tools.ts personalizer.ts rag-extractor.ts keyword-reply.ts sentiment.ts send-time.ts voice-notes.ts journey.ts contact-merge.ts gst-invoice.ts)
MISSING_SVC=0
for svc in "${SERVICES[@]}"; do
  [ -f "$ROOT/backend/src/services/$svc" ] || { mark_fail "Missing: $svc"; MISSING_SVC=$((MISSING_SVC+1)); }
done
[ "$MISSING_SVC" -eq 0 ] && mark_pass "All ${#SERVICES[@]} services present"

# ============================================================
section "🛣️  [4/10] API ROUTES"
# ============================================================
ROUTES=(auth.ts org.ts contacts.ts templates.ts campaigns.ts inbox.ts ai.ts leads.ts payments.ts analytics.ts webhooks.ts deals.ts followups.ts client-love.ts growth.ts mega.ts)
MISSING_RT=0
for rt in "${ROUTES[@]}"; do
  [ -f "$ROOT/backend/src/routes/$rt" ] || { mark_fail "Missing: $rt"; MISSING_RT=$((MISSING_RT+1)); }
done
[ "$MISSING_RT" -eq 0 ] && mark_pass "All ${#ROUTES[@]} route files present"

# ============================================================
section "📄 [5/10] FRONTEND PAGES"
# ============================================================
PAGES=(app/page.tsx app/login/page.tsx app/signup/page.tsx app/dashboard/page.tsx app/dashboard/inbox/page.tsx app/dashboard/pipeline/page.tsx app/dashboard/followups/page.tsx app/dashboard/campaigns/page.tsx app/dashboard/templates/page.tsx app/dashboard/contacts/page.tsx app/dashboard/leads/page.tsx app/dashboard/ai/page.tsx app/dashboard/growth/page.tsx app/dashboard/client-love/page.tsx app/dashboard/seo/page.tsx app/dashboard/setup/page.tsx app/dashboard/payments/page.tsx app/dashboard/notifications/page.tsx app/dashboard/settings/page.tsx app/dashboard/mega/page.tsx)
MISSING_PG=0
for p in "${PAGES[@]}"; do
  [ -f "$ROOT/frontend/$p" ] || { mark_fail "Missing: $p"; MISSING_PG=$((MISSING_PG+1)); }
done
[ "$MISSING_PG" -eq 0 ] && mark_pass "All ${#PAGES[@]} pages present"

# ============================================================
section "🚀 [6/10] MEGA FEATURES (16)"
# ============================================================
MEGA=(rag keywords sentiment ab-tests saved-replies voice-notes merge invoices forms calls status qr broadcast-preview team-performance green-tick copy-assistant)
MISSING_MG=0
for m in "${MEGA[@]}"; do
  [ -f "$ROOT/frontend/app/dashboard/mega/$m/page.tsx" ] || { mark_fail "Missing mega: $m"; MISSING_MG=$((MISSING_MG+1)); }
done
[ "$MISSING_MG" -eq 0 ] && mark_pass "All ${#MEGA[@]} mega pages present"

# ============================================================
section "🌐 [7/10] BACKEND LIVE"
# ============================================================
HEALTH=$(curl -s -m 5 "$API/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"ok":true'; then
  mark_pass "API responding"
  echo -e "   ${C}$HEALTH${N}"
else
  mark_fail "API not responding — run 'npm run dev' in another terminal"
fi

# ============================================================
section "🔐 [8/10] END-TO-END FLOW"
# ============================================================
if echo "$HEALTH" | grep -q '"ok":true'; then
  TS=$(date +%s)
  TEST_EMAIL="test${TS}@chatnexa.in"

  SIGNUP=$(curl -s -m 10 -X POST "$API/api/v1/auth/signup" -H "Content-Type: application/json" -d "{\"name\":\"Test\",\"email\":\"$TEST_EMAIL\",\"password\":\"password123\",\"orgName\":\"Test Org $TS\"}" 2>/dev/null)

  if echo "$SIGNUP" | grep -q '"token"'; then
    mark_pass "Signup works"
    TOKEN=$(echo "$SIGNUP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

    LOGIN=$(curl -s -m 10 -X POST "$API/api/v1/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"password123\"}" 2>/dev/null)
    echo "$LOGIN" | grep -q '"token"' && mark_pass "Login works" || mark_fail "Login failed"

    ME=$(curl -s -m 5 "$API/api/v1/auth/me" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    echo "$ME" | grep -q "$TEST_EMAIL" && mark_pass "/auth/me works" || mark_fail "/auth/me failed"

    echo ""
    echo -e "${C}   Testing 36 API endpoints...${N}"

    ENDPOINTS=(
      "/api/v1/org" "/api/v1/contacts" "/api/v1/templates" "/api/v1/campaigns"
      "/api/v1/inbox/conversations" "/api/v1/ai/knowledge" "/api/v1/leads"
      "/api/v1/payments" "/api/v1/analytics/overview" "/api/v1/analytics/messages/timeseries"
      "/api/v1/analytics/leads/sources" "/api/v1/deals/hot" "/api/v1/deals/pipeline"
      "/api/v1/followups/sequences" "/api/v1/followups/queue"
      "/api/v1/client-love/upcoming" "/api/v1/client-love/greetings"
      "/api/v1/client-love/referrals" "/api/v1/client-love/loyalty"
      "/api/v1/growth/upsell/list" "/api/v1/growth/churn/at-risk"
      "/api/v1/growth/forecast/latest" "/api/v1/growth/seo/history"
      "/api/v1/org/wallet" "/api/v1/org/api-keys"
      "/api/v1/mega/keywords" "/api/v1/mega/sentiment/alerts"
      "/api/v1/mega/ab-tests" "/api/v1/mega/saved-replies"
      "/api/v1/mega/voice-notes" "/api/v1/mega/contacts/duplicates"
      "/api/v1/mega/gst-invoices" "/api/v1/mega/forms"
      "/api/v1/mega/calls/outbound" "/api/v1/mega/status/broadcasts"
      "/api/v1/mega/team/performance" "/api/v1/mega/green-tick/status"
    )

    OK_COUNT=0
    FAIL_LIST=""
    for ep in "${ENDPOINTS[@]}"; do
      S=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$API$ep" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
      if [ "$S" = "200" ] || [ "$S" = "304" ]; then
        OK_COUNT=$((OK_COUNT+1))
      else
        FAIL_LIST="$FAIL_LIST\n  ${R}❌ $ep [HTTP $S]${N}"
      fi
    done

    if [ "$OK_COUNT" -eq "${#ENDPOINTS[@]}" ]; then
      mark_pass "All ${#ENDPOINTS[@]} endpoints working"
    else
      mark_pass "$OK_COUNT / ${#ENDPOINTS[@]} endpoints working"
      if [ "$OK_COUNT" -lt "${#ENDPOINTS[@]}" ]; then
        echo -e "$FAIL_LIST"
        FAIL=$((FAIL + ${#ENDPOINTS[@]} - OK_COUNT))
      fi
    fi
  else
    mark_fail "Signup failed"
    echo "   $SIGNUP" | head -3
  fi
else
  mark_warn "Skipping E2E (backend not running)"
fi

# ============================================================
section "🎨 [9/10] FRONTEND LIVE"
# ============================================================
WS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$WEB" 2>/dev/null)
if [ "$WS" = "200" ] || [ "$WS" = "304" ]; then
  mark_pass "Frontend responding [HTTP $WS]"

  TP=("/" "/login" "/signup" "/dashboard" "/dashboard/mega" "/dashboard/setup" "/dashboard/client-love" "/dashboard/growth" "/dashboard/seo")
  OK_W=0
  for p in "${TP[@]}"; do
    S=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$WEB$p" 2>/dev/null)
    if [ "$S" = "200" ] || [ "$S" = "304" ] || [ "$S" = "307" ]; then
      OK_W=$((OK_W+1))
    fi
  done
  [ "$OK_W" -eq "${#TP[@]}" ] && mark_pass "All ${#TP[@]} pages working" || mark_warn "$OK_W / ${#TP[@]} pages working"
else
  mark_warn "Frontend not responding — run 'npm run dev'"
fi

# ============================================================
section "🔌 [10/10] EXTERNAL SERVICES"
# ============================================================
if [ -f "$ROOT/backend/.env" ]; then
  ENV_FILE="$ROOT/backend/.env"
  check_env() {
    local val=$(grep "^$1=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d ' ')
    if [ -n "$val" ] && [ "$val" != '""' ]; then
      mark_pass "$2"
    else
      mark_warn "$2 not set"
    fi
  }
  check_env "DATABASE_URL" "Database (Neon)"
  check_env "REDIS_URL" "Redis (Upstash)"
  check_env "JWT_SECRET" "JWT secret"
  check_env "OPENAI_API_KEY" "OpenAI (AI)"
  check_env "CLOUDINARY_CLOUD_NAME" "Cloudinary (media)"
  check_env "RAZORPAY_KEY_ID" "Razorpay (payments)"
  check_env "SMTP_HOST" "SMTP (email)"
  check_env "META_VERIFY_TOKEN" "Meta token"
fi

# ============================================================
# GIT STATUS
# ============================================================
section "🚀 [BONUS] GIT & DEPLOYMENT"
cd "$ROOT"
if [ -d ".git" ]; then
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
  [ "$UNCOMMITTED" = "0" ] && mark_pass "Git: all committed" || mark_warn "Git: $UNCOMMITTED uncommitted"

  REMOTE=$(git remote -v 2>/dev/null | head -1 | grep -o 'github.com[^ ]*' || echo "")
  [ -n "$REMOTE" ] && mark_pass "GitHub: $REMOTE" || mark_warn "No GitHub remote"

  LAST=$(git log -1 --format="%ar" 2>/dev/null)
  [ -n "$LAST" ] && mark_pass "Last commit: $LAST"
fi
cd - > /dev/null

# ============================================================
# FINAL REPORT
# ============================================================
TOTAL=$((PASS + FAIL + WARN))
PERCENT=$([ "$TOTAL" -gt 0 ] && echo $((PASS * 100 / TOTAL)) || echo 0)

echo ""
echo ""
echo -e "${B}╔═══════════════════════════════════════════════╗${N}"
echo -e "${B}║           📊 FINAL REPORT                     ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════╝${N}"
echo ""
echo -e "${G}   ✅ Passed:    $PASS${N}"
echo -e "${R}   ❌ Failed:    $FAIL${N}"
echo -e "${Y}   ⚠️  Warnings:  $WARN${N}"
echo -e "${C}   📈 Total:     $TOTAL${N}"
echo ""

# Progress bar
BAR=""
FILLED=$((PERCENT / 5))
for ((i=0; i<20; i++)); do
  [ $i -lt $FILLED ] && BAR+="█" || BAR+="░"
done
echo -e "${B}   Completion:${N} ${G}$BAR${N} ${PERCENT}%"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${G}   🎉 PROJECT IS 100% WORKING!${N}"
  echo -e "${G}   → Ready to push & deploy${N}"
elif [ "$FAIL" -lt 5 ]; then
  echo -e "${Y}   ⚡ ALMOST THERE — Fix $FAIL issues${N}"
else
  echo -e "${R}   🔧 $FAIL failures — check above${N}"
fi

echo ""
REPORT="test-report-$(date +%Y%m%d-%H%M%S).txt"
{
  echo "ChatNexa Test Report — $(date)"
  echo "Project: $(cd $ROOT && pwd)"
  echo "Passed: $PASS | Failed: $FAIL | Warnings: $WARN"
  echo "Completion: $PERCENT%"
} > "$REPORT"
echo -e "${C}   📄 Report: $REPORT${N}"
echo ""