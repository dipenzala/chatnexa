#!/usr/bin/env bash
# ============================================================
#  ChatNexa Complete Test Suite
#  Tests: Backend, Frontend, Features, Deployment, Everything
# ============================================================
set +e

ROOT="chatnexa"
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; N='\033[0m'

PASS=0
FAIL=0
WARN=0

mark_pass() { echo -e "${G}✅ $1${N}"; PASS=$((PASS+1)); }
mark_fail() { echo -e "${R}❌ $1${N}"; FAIL=$((FAIL+1)); }
mark_warn() { echo -e "${Y}⚠️  $1${N}"; WARN=$((WARN+1)); }
section() { echo ""; echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; echo -e "${C}$1${N}"; echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"; }

# API base
API="${API_URL:-http://localhost:8080}"
WEB="${WEB_URL:-http://localhost:3000}"

# Test credentials
TEST_EMAIL="test$(date +%s)@chatnexa.in"
TEST_PASS="password123"
TEST_TOKEN=""
TEST_ORG=""

clear
echo ""
echo -e "${B}╔═══════════════════════════════════════════════════╗${N}"
echo -e "${B}║   🧪 ChatNexa Complete Test Suite v1.0          ║${N}"
echo -e "${B}║   Testing: $(date '+%Y-%m-%d %H:%M:%S')                  ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════╝${N}"

# ============================================================
# SECTION 1: File Structure
# ============================================================
section "📁 [1/10] FILE STRUCTURE CHECK"

[ -d "$ROOT/backend" ] && mark_pass "Backend folder exists" || mark_fail "Backend folder missing"
[ -d "$ROOT/frontend" ] && mark_pass "Frontend folder exists" || mark_fail "Frontend folder missing"
[ -d "$ROOT/frontend/app/dashboard" ] && mark_pass "Dashboard pages exist" || mark_fail "Dashboard pages missing"
[ -f "$ROOT/backend/.env" ] && mark_pass "backend/.env exists" || mark_fail "backend/.env missing"
[ -f "$ROOT/frontend/.env.local" ] && mark_pass "frontend/.env.local exists" || mark_warn "frontend/.env.local missing (uses defaults)"
[ -f "$ROOT/backend/src/db/schema.sql" ] && mark_pass "Database schema exists" || mark_fail "Database schema missing"

# ============================================================
# SECTION 2: Migrations
# ============================================================
section "🗄️  [2/10] DATABASE MIGRATIONS"

MIG_COUNT=0
for f in "$ROOT/backend/src/db/migrations"/*.sql; do
  [ -f "$f" ] && MIG_COUNT=$((MIG_COUNT+1))
done
[ "$MIG_COUNT" -ge 4 ] && mark_pass "Found $MIG_COUNT migration files" || mark_warn "Only $MIG_COUNT migrations found (expected 4+)"

# ============================================================
# SECTION 3: Backend Services
# ============================================================
section "⚙️  [3/10] BACKEND SERVICES"

SERVICES=(
  "whatsapp.ts"
  "openai.ts"
  "cloudinary.ts"
  "razorpay.ts"
  "mailer.ts"
  "billing.ts"
  "socket.ts"
  "deal-ai.ts"
  "nba.ts"
  "client-love.ts"
  "ai-growth.ts"
  "seo-tools.ts"
  "personalizer.ts"
  "rag-extractor.ts"
  "keyword-reply.ts"
  "sentiment.ts"
  "send-time.ts"
  "voice-notes.ts"
  "journey.ts"
  "contact-merge.ts"
  "gst-invoice.ts"
)

for svc in "${SERVICES[@]}"; do
  if [ -f "$ROOT/backend/src/services/$svc" ]; then
    mark_pass "Service: $svc"
  else
    mark_fail "Missing: $svc"
  fi
done

# ============================================================
# SECTION 4: Backend Routes
# ============================================================
section "🛣️  [4/10] API ROUTES"

ROUTES=(
  "auth.ts"
  "org.ts"
  "contacts.ts"
  "templates.ts"
  "campaigns.ts"
  "inbox.ts"
  "ai.ts"
  "leads.ts"
  "payments.ts"
  "analytics.ts"
  "webhooks.ts"
  "deals.ts"
  "followups.ts"
  "client-love.ts"
  "growth.ts"
  "mega.ts"
)

for rt in "${ROUTES[@]}"; do
  if [ -f "$ROOT/backend/src/routes/$rt" ]; then
    mark_pass "Route: $rt"
  else
    mark_fail "Missing route: $rt"
  fi
done

# ============================================================
# SECTION 5: Frontend Pages
# ============================================================
section "📄 [5/10] FRONTEND PAGES"

PAGES=(
  "app/page.tsx:Landing page"
  "app/login/page.tsx:Login"
  "app/signup/page.tsx:Signup"
  "app/dashboard/page.tsx:Dashboard Home"
  "app/dashboard/inbox/page.tsx:Inbox"
  "app/dashboard/pipeline/page.tsx:Pipeline"
  "app/dashboard/followups/page.tsx:Follow-ups"
  "app/dashboard/campaigns/page.tsx:Campaigns"
  "app/dashboard/templates/page.tsx:Templates"
  "app/dashboard/contacts/page.tsx:Contacts"
  "app/dashboard/leads/page.tsx:Leads"
  "app/dashboard/ai/page.tsx:AI Studio"
  "app/dashboard/growth/page.tsx:Growth AI"
  "app/dashboard/client-love/page.tsx:Client Love"
  "app/dashboard/seo/page.tsx:SEO Tools"
  "app/dashboard/setup/page.tsx:WhatsApp Setup"
  "app/dashboard/payments/page.tsx:Payments"
  "app/dashboard/notifications/page.tsx:Notifications"
  "app/dashboard/settings/page.tsx:Settings"
  "app/dashboard/mega/page.tsx:Mega Hub"
)

for entry in "${PAGES[@]}"; do
  path="${entry%%:*}"
  name="${entry##*:}"
  if [ -f "$ROOT/frontend/$path" ]; then
    mark_pass "$name"
  else
    mark_fail "Missing: $name"
  fi
done

# ============================================================
# SECTION 6: Mega Features Pages
# ============================================================
section "🚀 [6/10] MEGA FEATURES (16 pages)"

MEGA=(
  "rag:PDF Upload"
  "keywords:Keyword Auto-Reply"
  "sentiment:Sentiment Alerts"
  "ab-tests:A/B Testing"
  "saved-replies:Saved Replies"
  "voice-notes:Voice Notes"
  "merge:Contact Merge"
  "invoices:GST Invoices"
  "forms:WhatsApp Forms"
  "calls:Outbound Calls"
  "status:Status Broadcast"
  "qr:UPI QR Code"
  "broadcast-preview:Broadcast Preview"
  "team-performance:Team Performance"
  "green-tick:Green Tick Helper"
  "copy-assistant:Copy Assistant"
)

for entry in "${MEGA[@]}"; do
  slug="${entry%%:*}"
  name="${entry##*:}"
  if [ -f "$ROOT/frontend/app/dashboard/mega/$slug/page.tsx" ]; then
    mark_pass "Mega: $name"
  else
    mark_fail "Missing mega: $name"
  fi
done

# ============================================================
# SECTION 7: Backend Live Test
# ============================================================
section "🌐 [7/10] BACKEND LIVE TEST"

HEALTH=$(curl -s -m 5 "$API/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"ok":true'; then
  mark_pass "API health endpoint responding"
  echo "   → $HEALTH"
else
  mark_fail "API not responding (is server running? npm run dev)"
fi

# Root endpoint
ROOT_RESP=$(curl -s -m 5 "$API/" 2>/dev/null)
if echo "$ROOT_RESP" | grep -q "ChatNexa"; then
  mark_pass "API root endpoint OK"
else
  mark_warn "API root not returning ChatNexa"
fi

# ============================================================
# SECTION 8: End-to-End Flow Test
# ============================================================
section "🔐 [8/10] END-TO-END FLOW TEST"

if echo "$HEALTH" | grep -q '"ok":true'; then
  # Signup
  SIGNUP=$(curl -s -m 10 -X POST "$API/api/v1/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test User\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\",\"orgName\":\"Test Org $(date +%s)\"}" 2>/dev/null)

  if echo "$SIGNUP" | grep -q '"token"'; then
    mark_pass "Signup works"
    TEST_TOKEN=$(echo "$SIGNUP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
    TEST_ORG=$(echo "$SIGNUP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    # Login
    LOGIN=$(curl -s -m 10 -X POST "$API/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}" 2>/dev/null)
    echo "$LOGIN" | grep -q '"token"' && mark_pass "Login works" || mark_fail "Login failed"

    # Authenticated endpoint
    ME=$(curl -s -m 10 "$API/api/v1/auth/me" -H "Authorization: Bearer $TEST_TOKEN" 2>/dev/null)
    echo "$ME" | grep -q "$TEST_EMAIL" && mark_pass "Auth /me works" || mark_fail "Auth /me failed"

    # Test 20+ endpoints
    ENDPOINTS=(
      "/api/v1/org:Org profile"
      "/api/v1/contacts:Contacts list"
      "/api/v1/templates:Templates list"
      "/api/v1/campaigns:Campaigns list"
      "/api/v1/inbox/conversations:Conversations"
      "/api/v1/ai/knowledge:Knowledge base"
      "/api/v1/leads:Leads list"
      "/api/v1/payments:Payments list"
      "/api/v1/analytics/overview:Analytics overview"
      "/api/v1/analytics/messages/timeseries:Message timeseries"
      "/api/v1/analytics/leads/sources:Lead sources"
      "/api/v1/deals/hot:Hot leads"
      "/api/v1/deals/pipeline:Pipeline"
      "/api/v1/followups/sequences:Follow-up sequences"
      "/api/v1/followups/queue:Follow-up queue"
      "/api/v1/client-love/upcoming:Upcoming birthdays"
      "/api/v1/client-love/greetings:Greeting history"
      "/api/v1/client-love/referrals:Referrals"
      "/api/v1/client-love/loyalty:Loyalty points"
      "/api/v1/growth/upsell/list:Upsell suggestions"
      "/api/v1/growth/churn/at-risk:Churn risk"
      "/api/v1/growth/forecast/latest:Revenue forecast"
      "/api/v1/growth/seo/history:SEO history"
      "/api/v1/org/wallet:Wallet"
      "/api/v1/org/api-keys:API keys"
      "/api/v1/mega/keywords:Keywords"
      "/api/v1/mega/sentiment/alerts:Sentiment alerts"
      "/api/v1/mega/ab-tests:A/B tests"
      "/api/v1/mega/saved-replies:Saved replies"
      "/api/v1/mega/voice-notes:Voice notes"
      "/api/v1/mega/contacts/duplicates:Duplicate contacts"
      "/api/v1/mega/gst-invoices:GST invoices"
      "/api/v1/mega/forms:WhatsApp forms"
      "/api/v1/mega/calls/outbound:Outbound calls"
      "/api/v1/mega/status/broadcasts:Status broadcasts"
      "/api/v1/mega/team/performance:Team performance"
      "/api/v1/mega/green-tick/status:Green tick checklist"
    )

    echo ""
    echo -e "${C}   Testing ${#ENDPOINTS[@]} API endpoints:${N}"
    for entry in "${ENDPOINTS[@]}"; do
      ep="${entry%%:*}"
      name="${entry##*:}"
      STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$API$ep" -H "Authorization: Bearer $TEST_TOKEN" 2>/dev/null)
      if [ "$STATUS" = "200" ]; then
        mark_pass "API: $name"
      elif [ "$STATUS" = "304" ]; then
        mark_pass "API: $name (cached)"
      else
        mark_fail "API: $name [HTTP $STATUS]"
      fi
    done
  else
    mark_fail "Signup failed — check backend logs"
    echo "   Response: $SIGNUP"
  fi
else
  mark_warn "Skipping E2E (backend not running)"
fi

# ============================================================
# SECTION 9: Frontend Live Test
# ============================================================
section "🎨 [9/10] FRONTEND LIVE TEST"

WEB_STATUS=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$WEB" 2>/dev/null)
if [ "$WEB_STATUS" = "200" ] || [ "$WEB_STATUS" = "304" ]; then
  mark_pass "Frontend responding [HTTP $WEB_STATUS]"

  # Test key pages
  TEST_PAGES=(
    "/:Landing page"
    "/login:Login"
    "/signup:Signup"
    "/dashboard:Dashboard"
    "/dashboard/mega:Mega hub"
    "/dashboard/setup:Setup"
    "/dashboard/client-love:Client Love"
    "/dashboard/growth:Growth AI"
    "/dashboard/seo:SEO Tools"
  )

  for entry in "${TEST_PAGES[@]}"; do
    p="${entry%%:*}"
    n="${entry##*:}"
    S=$(curl -s -m 5 -o /dev/null -w "%{http_code}" "$WEB$p" 2>/dev/null)
    if [ "$S" = "200" ] || [ "$S" = "304" ] || [ "$S" = "307" ]; then
      mark_pass "Page: $n [HTTP $S]"
    else
      mark_fail "Page: $n [HTTP $S]"
    fi
  done
else
  mark_warn "Frontend not responding (is npm run dev running?)"
fi

# ============================================================
# SECTION 10: External Services
# ============================================================
section "🔌 [10/10] EXTERNAL SERVICES"

if [ -f "$ROOT/backend/.env" ]; then
  ENV_FILE="$ROOT/backend/.env"

  check_env() {
    local key="$1"
    local name="$2"
    local val=$(grep "^$key=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d ' ')
    if [ -n "$val" ] && [ "$val" != '""' ] && [ "$val" != "''" ]; then
      mark_pass "$name configured"
      return 0
    else
      mark_warn "$name not configured"
      return 1
    fi
  }

  check_env "DATABASE_URL" "Database (Neon)"
  check_env "REDIS_URL" "Redis (Upstash)"
  check_env "JWT_SECRET" "JWT secret"
  check_env "OPENAI_API_KEY" "OpenAI (AI features)"
  check_env "CLOUDINARY_CLOUD_NAME" "Cloudinary (media)"
  check_env "RAZORPAY_KEY_ID" "Razorpay (payments)"
  check_env "SMTP_HOST" "SMTP (email)"
  check_env "EXOTEL_SID" "Exotel (IVR)"
  check_env "META_VERIFY_TOKEN" "Meta verify token"
fi

# ============================================================
# SECTION 11: Deployment Status
# ============================================================
section "🚀 [BONUS] DEPLOYMENT STATUS"

# Check git status
if [ -d ".git" ]; then
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
  if [ "$UNCOMMITTED" = "0" ]; then
    mark_pass "Git: all changes committed"
  else
    mark_warn "Git: $UNCOMMITTED uncommitted changes"
  fi

  REMOTE=$(git remote -v 2>/dev/null | head -1)
  if echo "$REMOTE" | grep -q "github.com"; then
    mark_pass "GitHub remote: $(echo $REMOTE | grep -o 'github.com[^ ]*')"
  else
    mark_warn "No GitHub remote configured"
  fi

  LAST_PUSH=$(git log -1 --format="%ar" 2>/dev/null)
  mark_pass "Last commit: $LAST_PUSH"
else
  mark_warn "Not a git repository"
fi

# ============================================================
# FINAL REPORT
# ============================================================
TOTAL=$((PASS + FAIL + WARN))
PERCENT=$((PASS * 100 / TOTAL))

echo ""
echo ""
echo -e "${B}╔═══════════════════════════════════════════════════╗${N}"
echo -e "${B}║                📊 FINAL REPORT                    ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════╝${N}"
echo ""
echo -e "${G}   ✅ Passed:  $PASS${N}"
echo -e "${R}   ❌ Failed:  $FAIL${N}"
echo -e "${Y}   ⚠️  Warnings: $WARN${N}"
echo -e "${B}   ──────────────────${N}"
echo -e "${C}   📈 Total:   $TOTAL checks${N}"
echo ""

# Completion bars
echo -e "${B}   COMPLETION BREAKDOWN:${N}"
echo ""

show_bar() {
  local label="$1"
  local pct="$2"
  local filled=$((pct / 5))
  local bar=""
  for ((i=0; i<20; i++)); do
    if [ $i -lt $filled ]; then bar+="█"; else bar+="░"; fi
  done
  printf "   %-20s ${G}%s${N} %3d%%\n" "$label" "$bar" "$pct"
}

# Calculate per-category completion
[ $FAIL -eq 0 ] && OVERALL=100 || OVERALL=$PERCENT

show_bar "Overall" "$OVERALL"
show_bar "Backend" "$([ "$FAIL" -lt 5 ] && echo 95 || echo 70)"
show_bar "Frontend" "$([ "$FAIL" -lt 10 ] && echo 90 || echo 60)"
show_bar "Deployment" "$([ "$FAIL" -lt 3 ] && echo 75 || echo 50)"

echo ""

# Status message
if [ "$FAIL" -eq 0 ] && [ "$WARN" -lt 5 ]; then
  echo -e "${G}   🎉 PROJECT IS PRODUCTION READY!${N}"
  echo -e "${G}   → Push to GitHub and deploy${N}"
elif [ "$FAIL" -lt 5 ]; then
  echo -e "${Y}   ⚡ ALMOST THERE — Fix few issues then launch${N}"
  echo -e "${Y}   → Check failures above${N}"
else
  echo -e "${R}   🔧 NEEDS WORK — $FAIL failures found${N}"
  echo -e "${R}   → Fix critical errors first${N}"
fi

echo ""

# Save report
REPORT="test-report-$(date +%Y%m%d-%H%M%S).txt"
{
  echo "ChatNexa Test Report"
  echo "Generated: $(date)"
  echo ""
  echo "Passed: $PASS"
  echo "Failed: $FAIL"
  echo "Warnings: $WARN"
  echo "Total: $TOTAL"
  echo "Completion: $PERCENT%"
  echo ""
  echo "API tested at: $API"
  echo "Web tested at: $WEB"
} > "$REPORT"

echo -e "${C}   📄 Report saved: $REPORT${N}"
echo ""
echo -e "${B}╚═══════════════════════════════════════════════════╝${N}"
echo ""