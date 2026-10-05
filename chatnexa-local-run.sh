#!/usr/bin/env bash
# ============================================================
#  CHATNEXA — LOCAL RUN + VERCEL SYNC
#  Runs backend locally + tunnel + frontend, ready for Vercel
# ============================================================
set +e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; M='\033[0;35m'; N='\033[0m'

# Config
VERCEL_URL="https://chatnexa-nine.vercel.app"
BACKEND_PORT=8080
FRONTEND_PORT=3000

cd ~/OneDrive/Desktop/chatnexa/chatnexa
PD=$(pwd)

echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}║  🚀 CHATNEXA LOCAL + VERCEL SYNC                     ║${N}"
echo -e "${B}║  Frontend: $VERCEL_URL${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════╝${N}"
echo ""

# ============================================================
# [1] KILL OLD PROCESSES
# ============================================================
echo -e "${B}[1/7] Cleaning up...${N}"
taskkill //F //IM node.exe 2>/dev/null || true
taskkill //F //IM cloudflared.exe 2>/dev/null || true
sleep 2
rm -rf backend/dist frontend/.next /tmp/cnx-*.log
echo -e "${G}  ✅ Cleaned${N}"

# ============================================================
# [2] VERIFY PROJECT STRUCTURE
# ============================================================
echo ""
echo -e "${B}[2/7] Verifying project...${N}"

if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
  echo -e "${R}  ❌ Run this from chatnexa/chatnexa/ folder${N}"
  exit 1
fi

if [ ! -f "backend/.env" ]; then
  echo -e "${Y}  ⚠️  backend/.env missing — creating from example${N}"
  [ -f "backend/.env.example" ] && cp backend/.env.example backend/.env
fi

echo -e "${G}  ✅ Project structure OK${N}"

# ============================================================
# [3] UPDATE CORS IN BACKEND (allow Vercel)
# ============================================================
echo ""
echo -e "${B}[3/7] Configuring backend for Vercel...${N}"

# Update FRONTEND_URL in .env
if grep -q "^FRONTEND_URL=" backend/.env 2>/dev/null; then
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=$VERCEL_URL|" backend/.env
else
  echo "FRONTEND_URL=$VERCEL_URL" >> backend/.env
fi

# Make CORS permissive for dev
node << 'NODE_SCRIPT' 2>/dev/null
const fs = require('fs');
const path = 'backend/src/server.ts';
if (!fs.existsSync(path)) process.exit(0);
let src = fs.readFileSync(path, 'utf8');
if (src.includes('trycloudflare.com')) {
  console.log('  ✅ CORS already configured');
  process.exit(0);
}
const oldCors = /app\.use\(cors\(\{[^}]+\}\)\);/;
const newCors = `app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin.endsWith('.vercel.app') || origin.endsWith('.trycloudflare.com')) return cb(null, true);
    if (['http://localhost:3000', 'http://localhost:3001'].includes(origin)) return cb(null, true);
    if (origin === process.env.FRONTEND_URL) return cb(null, true);
    return cb(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));`;
if (oldCors.test(src)) {
  src = src.replace(oldCors, newCors);
  fs.writeFileSync(path, src);
  console.log('  ✅ CORS broadened for Vercel');
} else {
  console.log('  ⚠️  CORS pattern not found — manual check needed');
}
NODE_SCRIPT

# Update frontend/.env.local
cat > frontend/.env.local << 'ENV_END'
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
ENV_END
echo -e "${G}  ✅ Local frontend env configured${N}"

# ============================================================
# [4] START BACKEND
# ============================================================
echo ""
echo -e "${B}[4/7] Starting backend on port $BACKEND_PORT...${N}"

cd backend
npm run dev > /tmp/cnx-backend.log 2>&1 &
cd ..

echo -e "${C}  Waiting up to 60s for backend...${N}"
READY=0
for i in {1..30}; do
  sleep 2
  S=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/health 2>/dev/null)
  if [ "$S" = "200" ]; then
    READY=1
    echo -e "${G}  ✅ Backend up after $((i*2))s${N}"
    break
  fi
done

if [ "$READY" != "1" ]; then
  echo -e "${R}  ❌ Backend failed to start${N}"
  echo -e "${Y}  Last 15 lines:${N}"
  tail -15 /tmp/cnx-backend.log | sed 's/^/    /'
  exit 1
fi

# ============================================================
# [5] START CLOUDFLARED TUNNEL
# ============================================================
echo ""
echo -e "${B}[5/7] Starting cloudflared tunnel...${N}"

# Find cloudflared
CLOUDFLARED=""
for path in "/c/Program Files/cloudflared/cloudflared.exe" "$PD/cloudflared.exe" "$(which cloudflared 2>/dev/null)"; do
  if [ -f "$path" ] || command -v "$path" >/dev/null 2>&1; then
    CLOUDFLARED="$path"
    break
  fi
done

if [ -z "$CLOUDFLARED" ]; then
  echo -e "${Y}  cloudflared not found — downloading...${N}"
  curl -L -o "$PD/cloudflared.exe" \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" 2>&1 | tail -1
  CLOUDFLARED="$PD/cloudflared.exe"
fi

if [ ! -f "$CLOUDFLARED" ]; then
  echo -e "${R}  ❌ cloudflared download failed${N}"
  echo -e "${Y}  Continuing without tunnel (local only)${N}"
  TUNNEL_URL=""
else
  "$CLOUDFLARED" tunnel --url http://localhost:$BACKEND_PORT > /tmp/cnx-tunnel.log 2>&1 &

  echo -e "${C}  Waiting for tunnel URL (max 60s)...${N}"
  TUNNEL_URL=""
  for i in {1..30}; do
    sleep 2
    TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/cnx-tunnel.log 2>/dev/null | head -1)
    if [ -n "$TUNNEL_URL" ]; then break; fi
  done

  if [ -n "$TUNNEL_URL" ]; then
    echo -e "${G}  ✅ Tunnel: $TUNNEL_URL${N}"
    # Test tunnel
    sleep 3
    T=$(curl -s -m 10 "$TUNNEL_URL/health" 2>/dev/null)
    echo "$T" | grep -q '"ok":true' && echo -e "${G}  ✅ Tunnel verified${N}" || echo -e "${Y}  ⚠️  Tunnel slow — may still work${N}"
  else
    echo -e "${R}  ❌ Tunnel URL not detected${N}"
  fi
fi

# ============================================================
# [6] START FRONTEND (optional local test)
# ============================================================
echo ""
echo -e "${B}[6/7] Starting local frontend on port $FRONTEND_PORT...${N}"

cd frontend
npm run dev > /tmp/cnx-frontend.log 2>&1 &
cd ..

sleep 15
FE_OK=0
for i in {1..15}; do
  S=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT 2>/dev/null)
  if [ "$S" = "200" ] || [ "$S" = "304" ]; then
    FE_OK=1
    echo -e "${G}  ✅ Local frontend up${N}"
    break
  fi
  sleep 2
done

[ "$FE_OK" != "1" ] && echo -e "${Y}  ⚠️  Frontend slow (skip — you can use Vercel instead)${N}"

# ============================================================
# [7] FINAL REPORT + INSTRUCTIONS
# ============================================================
echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}║              ✅ ALL SERVICES RUNNING                  ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════╝${N}"
echo ""
echo -e "${C}  Local Backend:  ${G}http://localhost:$BACKEND_PORT${N}"
echo -e "${C}  Local Frontend: ${G}http://localhost:$FRONTEND_PORT${N}"
if [ -n "$TUNNEL_URL" ]; then
  echo -e "${C}  Public Tunnel:  ${G}$TUNNEL_URL${N}"
fi
echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${B}  🎯 TEST LOCALLY FIRST${N}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo ""
echo -e "  ${Y}1.${N} Browser khol: ${G}http://localhost:$FRONTEND_PORT/dashboard/setup${N}"
echo -e "  ${Y}2.${N} ${R}Ctrl+Shift+R${N} (hard refresh)"
echo -e "  ${Y}3.${N} Step 4 → Phone Number ID + Access Token daalo"
echo -e "  ${Y}4.${N} ${G}Verify with Meta${N} click karo"
echo ""
echo -e "  ${G}Local me sahi chal raha hai?${N} Fir Vercel pe bhi chalega."
echo ""

if [ -n "$TUNNEL_URL" ]; then
  echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  echo -e "${B}  🚀 VERCEL PE TEST KARNE KE LIYE${N}"
  echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
  echo ""
  echo -e "${Y}STEP 1 — Vercel me env vars update karo:${N}"
  echo -e "  URL: ${G}https://vercel.com/dashboard${N}"
  echo -e "  Project: ${C}chatnexa${N} → ${C}Settings${N} → ${C}Environment Variables${N}"
  echo ""
  echo -e "  ${B}Variable 1:${N}"
  echo -e "    Key:   ${C}NEXT_PUBLIC_API_URL${N}"
  echo -e "    Value: ${G}$TUNNEL_URL${N}"
  echo ""
  echo -e "  ${B}Variable 2:${N}"
  echo -e "    Key:   ${C}NEXT_PUBLIC_SOCKET_URL${N}"
  echo -e "    Value: ${G}$TUNNEL_URL${N}"
  echo ""
  echo -e "  ${Y}Save dono → Production + Preview select karo${N}"
  echo ""
  echo -e "${Y}STEP 2 — Vercel Redeploy:${N}"
  echo -e "  ${G}https://vercel.com/dashboard/chatnexa${N} → Deployments → ⋯ → ${C}Redeploy${N}"
  echo ""
  echo -e "${Y}STEP 3 — Vercel test:${N}"
  echo -e "  ${G}$VERCEL_URL/dashboard/setup${N}"
  echo -e "  ${R}Ctrl+Shift+R${N} → Verify click"
  echo ""
  echo -e "${M}  ⚠️  IMPORTANT:${N}"
  echo -e "${M}  Ye tunnel URL sirf is session ke liye hai.${N}"
  echo -e "${M}  Script band karne se tunnel band ho jayega.${N}"
  echo -e "${M}  Production ke liye Render pe deploy karna padega.${N}"
fi

echo ""
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${G}  🔄 Terminal band mat karo — backend + tunnel chal rahe hain${N}"
echo -e "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo ""
echo -e "${Y}  Stop karne ke liye: Ctrl+C${N}"
echo ""

# Keep running
trap 'echo ""; echo -e "${Y}Stopping...${N}"; taskkill //F //IM node.exe 2>/dev/null; taskkill //F //IM cloudflared.exe 2>/dev/null; exit 0' INT
wait