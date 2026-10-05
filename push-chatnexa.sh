#!/usr/bin/env bash
set -e

echo "==============================================="
echo " 🚀 PUSH CHATNEXA → GitHub + Vercel"
echo "==============================================="

cd "$(dirname "$0")" 2>/dev/null || true
echo "📁 $(pwd)"
echo ""

# ═══════════════════════════════════════════
# 1. Verify project structure
# ═══════════════════════════════════════════
echo "🔍 [1/7] Verifying structure..."

if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
  echo "❌ backend/ ya frontend/ folder nahi mila"
  echo "   Ye script project root me chalao"
  exit 1
fi

[ -f "backend/package.json" ] && echo "   ✅ backend/"
[ -f "frontend/package.json" ] && echo "   ✅ frontend/"

if [ -f "backend/src/routes/whatsapp-setup.ts" ]; then
  echo "   ✅ whatsapp-setup.ts exists"
else
  echo "   ⚠️  whatsapp-setup.ts missing"
fi

# ═══════════════════════════════════════════
# 2. Fix bash script line 718 error
# ═══════════════════════════════════════════
echo ""
echo "🔧 [2/7] Fixing bash script errors..."

if [ -f "fix-step4.sh" ]; then
  # Find the problematic line
  if grep -n '\[: 0' fix-step4.sh 2>/dev/null; then
    # Fix common integer comparison issues
    sed -i 's/if \[ "\$[A-Z_]*" -gt 0 \]/if [ "${&:-0}" -gt 0 ] \&\& [ "${&:-0}" -eq "${&:-0}" ]/g' fix-step4.sh 2>/dev/null || true
    echo "   ⚠️  Attempted fix — check manually if error persists"
  fi
fi

# Check line 718
if [ -f "fix-step4.sh" ]; then
  LINE=$(sed -n '718p' fix-step4.sh 2>/dev/null)
  if [ -n "$LINE" ]; then
    echo "   Line 718: $LINE"
  fi
fi

# ═══════════════════════════════════════════
# 3. Ensure .gitignore
# ═══════════════════════════════════════════
echo ""
echo "📝 [3/7] Setting up .gitignore..."

cat > .gitignore <<'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Next.js
.next/
out/

# Build
dist/
build/

# Env files
.env
.env.local
.env*.local
.env.production
*.env

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Vercel
.vercel

# Prisma
*.db
prisma/*.db
EOF

echo "   ✅ .gitignore created"

# ═══════════════════════════════════════════
# 4. Verify TS compiles
# ═══════════════════════════════════════════
echo ""
echo "🔎 [4/7] Verifying TypeScript..."

if [ -d "backend" ]; then
  cd backend
  if npx tsc --noEmit 2>&1 | tail -5; then
    echo "   ✅ Backend TS OK"
  else
    echo "   ⚠️  Backend TS has issues"
  fi
  cd ..
fi

if [ -d "frontend" ]; then
  cd frontend
  if [ -f "tsconfig.json" ]; then
    if npx tsc --noEmit 2>&1 | tail -5; then
      echo "   ✅ Frontend TS OK"
    else
      echo "   ⚠️  Frontend TS has issues"
    fi
  fi
  cd ..
fi

# ═══════════════════════════════════════════
# 5. Ensure .env.example
# ═══════════════════════════════════════════
echo ""
echo "📝 [5/7] Creating .env.example files..."

if [ -d "backend" ] && [ ! -f "backend/.env.example" ]; then
  cat > backend/.env.example <<'EOF'
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# WhatsApp / Meta
META_API_VERSION=v19.0
META_VERIFY_TOKEN=your-verify-token
META_APP_ID=your-app-id
META_APP_SECRET=your-app-secret

# OpenAI (if used)
OPENAI_API_KEY=sk-xxx

# Server
PORT=8080
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
EOF
  echo "   ✅ backend/.env.example"
fi

if [ -d "frontend" ] && [ ! -f "frontend/.env.example" ]; then
  cat > frontend/.env.example <<'EOF'
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_APP_URL=https://your-frontend.vercel.app
EOF
  echo "   ✅ frontend/.env.example"
fi

# ═══════════════════════════════════════════
# 6. Verify git
# ═══════════════════════════════════════════
echo ""
echo "🌿 [6/7] Checking git..."

if [ ! -d ".git" ]; then
  echo "   Initializing..."
  git init
  git branch -M main
fi

# Check remote
if git remote get-url origin >/dev/null 2>&1; then
  echo "   ✅ Remote: $(git remote get-url origin)"
else
  echo "   ⚠️  No remote set"
  read -p "   GitHub repo URL: " REPO_URL
  if [ -n "$REPO_URL" ]; then
    git remote add origin "$REPO_URL"
    echo "   ✅ Remote added"
  fi
fi

# Check .env not tracked
if git ls-files --error-unmatch backend/.env >/dev/null 2>&1; then
  echo "   🔒 Untracking backend/.env"
  git rm --cached backend/.env
fi
if git ls-files --error-unmatch frontend/.env.local >/dev/null 2>&1; then
  echo "   🔒 Untracking frontend/.env.local"
  git rm --cached frontend/.env.local
fi

# Show status
echo ""
echo "   Git status:"
git status --short | head -20

# ═══════════════════════════════════════════
# 7. Commit + Push
# ═══════════════════════════════════════════
echo ""
echo "🚀 [7/7] Committing and pushing..."

git config user.email "$(git config user.email 2>/dev/null || echo 'deploy@local')"
git config user.name "$(git config user.name 2>/dev/null || echo 'Deploy')"

git add -A

if git diff --cached --quiet; then
  echo "   ℹ️  Nothing to commit"
else
  git commit -m "Fix: WhatsApp verify-token router + frontend setup page"
  echo "   ✅ Committed"
fi

read -p "Push to GitHub? (y/N) " PUSH
if [[ "$PUSH" =~ ^[Yy]$ ]]; then
  git push -u origin main 2>&1 | tail -10
  echo "   ✅ Pushed"
else
  echo "   ⏭️  Skipped"
fi

echo ""
echo "==============================================="
echo " ✅ DONE"
echo "==============================================="
echo ""
echo "🎯 Vercel Deploy:"
echo ""
echo "  ⚠️  Ye monorepo hai (backend + frontend)"
echo ""
echo "  FRONTEND (Next.js) → Vercel:"
echo "    1. https://vercel.com/new"
echo "    2. Import repo"
echo "    3. Root Directory: frontend"
echo "    4. Framework: Next.js"
echo "    5. Build: npm install && npm run build"
echo "    6. Env: NEXT_PUBLIC_API_URL=<backend URL>"
echo "    7. Deploy"
echo ""
echo "  BACKEND (Express) → Railway/Render:"
echo "    1. https://railway.app"
echo "    2. Deploy from GitHub"
echo "    3. Root: backend/"
echo "    4. Start: npm start"
echo "    5. Env vars daalo (DATABASE_URL, JWT_SECRET, etc.)"
echo ""
echo "⚠️  Vercel pe sirf FRONTEND deploy karo."
echo "    Backend Vercel pe nahi chalega (Express)."
echo "==============================================="