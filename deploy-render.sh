#!/usr/bin/env bash
set -e

echo "==============================================="
echo " 🚀 DEPLOY BACKEND → RENDER (Free)"
echo "==============================================="

cd "$(dirname "$0")" 2>/dev/null || true
[ -f "package.json" ] || { echo "❌ project root me chalao"; exit 1; }
echo "📁 $(pwd)"
echo ""

# ═══════════════════════════════════════════
# 1. Detect monorepo structure
# ═══════════════════════════════════════════
echo "🔍 [1/4] Detecting structure..."

if [ -d "backend" ] && [ -d "frontend" ]; then
  echo "   ✅ Monorepo detected (backend + frontend)"
  PROJECT_TYPE="monorepo"
  BACKEND_DIR="backend"
elif [ -f "package.json" ] && grep -q "express" package.json; then
  echo "   ✅ Express project detected"
  PROJECT_TYPE="express"
  BACKEND_DIR="."
else
  echo "   ⚠️  Could not detect project type"
  exit 1
fi

# ═══════════════════════════════════════════
# 2. Create render.yaml
# ═══════════════════════════════════════════
echo ""
echo "📝 [2/4] Creating render.yaml..."

if [ "$PROJECT_TYPE" = "monorepo" ]; then
  cat > render.yaml <<'EOF'
services:
  # Backend - Express API
  - type: web
    name: chatnexa-backend
    env: node
    region: singapore
    plan: free
    rootDir: backend
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 8080
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: JWT_REFRESH_SECRET
        sync: false
      - key: META_API_VERSION
        value: v19.0
      - key: META_VERIFY_TOKEN
        sync: false
      - key: META_APP_ID
        sync: false
      - key: META_APP_SECRET
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: CORS_ORIGIN
        sync: false
EOF
  echo "   ✅ render.yaml (monorepo)"
else
  cat > render.yaml <<'EOF'
services:
  - type: web
    name: express-backend
    env: node
    region: singapore
    plan: free
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 8080
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: JWT_REFRESH_SECRET
        sync: false
EOF
  echo "   ✅ render.yaml (express)"
fi

# ═══════════════════════════════════════════
# 3. Ensure health endpoint exists
# ═══════════════════════════════════════════
echo ""
echo "🩺 [3/4] Verifying health endpoint..."

HEALTH_FOUND=false
for f in "$BACKEND_DIR/src/index.ts" "$BACKEND_DIR/src/index.js" "$BACKEND_DIR/src/app.ts" "$BACKEND_DIR/src/server.ts"; do
  if [ -f "$f" ]; then
    if grep -q "/health\|/api/health" "$f" 2>/dev/null; then
      echo "   ✅ Health endpoint found in $f"
      HEALTH_FOUND=true
      break
    fi
  fi
done

if [ "$HEALTH_FOUND" = false ]; then
  echo "   ⚠️  Health endpoint not found"
  echo "   Render health checks ke liye chahiye"
  echo "   Manually add karo:"
  echo "     app.get('/health', (req, res) => res.json({ ok: true }));"
fi

# ═══════════════════════════════════════════
# 4. Create DEPLOY.md
# ═══════════════════════════════════════════
echo ""
echo "📝 [4/4] Creating deployment guide..."

cat > DEPLOY-BACKEND.md <<'EOF'
# 🚀 Backend Deploy — Free Options

## Option 1: Render (Recommended)

### Steps:
1. https://render.com → Sign up with GitHub
2. New → **Web Service**
3. Connect repo `dipenzala/chatnexa`
4. Settings:
   - **Name:** `chatnexa-backend`
   - **Region:** Singapore
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
5. Environment Variables (add):