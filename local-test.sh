#!/usr/bin/env bash
set -e

echo "==============================================="
echo " 🏠 LOCAL BACKEND TEST"
echo "==============================================="

cd "$(dirname "$0")" 2>/dev/null || true
echo "📁 $(pwd)"
echo ""

# ═══════════════════════════════════════════
# 1. Project structure detect
# ═══════════════════════════════════════════
echo "🔍 [1/6] Detecting backend..."

if [ -d "backend" ]; then
  BACKEND_DIR="backend"
elif [ -f "package.json" ] && grep -q express package.json; then
  BACKEND_DIR="."
else
  echo "❌ Backend folder nahi mila"
  exit 1
fi

echo "   ✅ Backend: $BACKEND_DIR"

cd "$BACKEND_DIR"

# ═══════════════════════════════════════════
# 2. Check .env
# ═══════════════════════════════════════════
echo ""
echo "🔍 [2/6] Checking .env..."

if [ ! -f ".env" ]; then
  echo "   ⚠️  .env missing — creating template..."
  cat > .env <<'EOF'
# ═══════════════════════════════════════════
# LOCAL DEV — Fill these values
# ═══════════════════════════════════════════

# Database — Neon URL or local Postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatnexa?sslmode=disable

# JWT Secrets (min 32 chars) — auto-generated below
JWT_SECRET=change-this-local-secret-min-32-chars-long
JWT_REFRESH_SECRET=change-this-refresh-secret-min-32-chars

# WhatsApp / Meta
META_API_VERSION=v19.0
META_VERIFY_TOKEN=local-test-verify-token
META_APP_ID=
META_APP_SECRET=

# OpenAI (optional)
OPENAI_API_KEY=

# Server
PORT=8080
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
EOF

  # Generate JWT secrets
  if command -v openssl >/dev/null 2>&1; then
    JWT=$(openssl rand -hex 32)
    REFRESH=$(openssl rand -hex 32)
    sed -i "s|change-this-local-secret-min-32-chars-long|$JWT|" .env
    sed -i "s|change-this-refresh-secret-min-32-chars|$REFRESH|" .env
  fi

  echo "   ✅ .env created with template"
  echo ""
  echo "   ⚠️  EDIT karo .env file — DATABASE_URL set karo"
  echo "   Command: nano .env"
else
  echo "   ✅ .env exists"
fi

# ═══════════════════════════════════════════
# 3. Check dependencies
# ═══════════════════════════════════════════
echo ""
echo "📦 [3/6] Checking dependencies..."

if [ ! -d "node_modules" ]; then
  echo "   Installing..."
  npm install --silent
  echo "   ✅ Installed"
else
  echo "   ✅ node_modules exists"
fi

# ═══════════════════════════════════════════
# 4. Verify TS compiles
# ═══════════════════════════════════════════
echo ""
echo "🔎 [4/6] Checking TypeScript..."

if [ -f "tsconfig.json" ]; then
  if npx tsc --noEmit 2>&1 | tail -5; then
    echo "   ✅ TS OK"
  else
    echo "   ⚠️  TS errors — check karo"
  fi
fi

# ═══════════════════════════════════════════
# 5. Check database connectivity
# ═══════════════════════════════════════════
echo ""
echo "🗄️  [5/6] Checking database..."

DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DB_URL" ]; then
  echo "   ⚠️  DATABASE_URL empty"
else
  # Check if local or remote
  if [[ "$DB_URL" == *"localhost"* ]] || [[ "$DB_URL" == *"127.0.0.1"* ]]; then
    echo "   📍 Local Postgres URL detected"
    
    # Try connection
    if command -v psql >/dev/null 2>&1; then
      if psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
        echo "   ✅ Local DB reachable"
      else
        echo "   ⚠️  Local DB not reachable"
        echo "   Start Postgres: pg_ctl start"
        echo "   Or: sudo service postgresql start"
      fi
    fi
  else
    echo "   📍 Remote URL detected (Neon/etc)"
    echo "   ✅ Assuming reachable"
  fi
fi

# ═══════════════════════════════════════════
# 6. START SERVER
# ═══════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════"
echo " 🚀 STARTING BACKEND"
echo "═══════════════════════════════════════════"
echo ""
echo "   Port:    $(grep '^PORT=' .env | cut -d'=' -f2 || echo 8080)"
echo "   Mode:    $(grep '^NODE_ENV=' .env | cut -d'=' -f2 || echo development)"
echo ""
echo "   Local URL:"
echo "      http://localhost:8080"
echo ""
echo "   Test endpoints:"
echo "      http://localhost:8080/health"
echo "      http://localhost:8080/api/v1/org/whatsapp/health"
echo ""
echo "   Band karne ke liye: Ctrl+C"
echo ""
echo "═══════════════════════════════════════════"
echo ""

# Determine start command
if grep -q '"dev"' package.json; then
  npm run dev
elif grep -q '"start"' package.json; then
  npm run start
else
  # Fallback
  if [ -f "src/index.ts" ]; then
    npx tsx src/index.ts
  elif [ -f "src/index.js" ]; then
    node src/index.js
  else
    echo "❌ No start command found"
    exit 1
  fi
fi