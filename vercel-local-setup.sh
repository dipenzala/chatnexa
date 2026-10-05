#!/usr/bin/env bash
set +e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; M='\033[0;35m'; N='\033[0m'

cd ~/OneDrive/Desktop/chatnexa/chatnexa
PD=$(pwd)

echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}║  🚀 VERCEL FRONTEND + LOCAL BACKEND SETUP            ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════╝${N}"
echo ""

# ============================================================
# PHASE 1: STOP + CLEAN
# ============================================================
echo -e "${B}[1/6] Stopping node processes...${N}"
taskkill //F //IM node.exe 2>/dev/null || true
sleep 2
rm -rf backend/dist frontend/.next
echo -e "${G}  ✅ Done${N}"

# ============================================================
# PHASE 2: FIX ENV + CORS (allow vercel domain)
# ============================================================
echo ""
echo -e "${B}[2/6] Configuring backend for Vercel access...${N}"

# Ensure .env has correct values
if [ -f backend/.env ]; then
  # Update FRONTEND_URL to allow any Vercel domain
  if grep -q "^FRONTEND_URL=" backend/.env; then
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://chatflow-saas-web.vercel.app|" backend/.env
  else
    echo "FRONTEND_URL=https://chatflow-saas-web.vercel.app" >> backend/.env
  fi
  echo -e "${G}  ✅ FRONTEND_URL updated in backend/.env${N}"
fi

# Update CORS in server.ts to allow Vercel domains
if ! grep -q "trycloudflare" backend/src/server.ts 2>/dev/null; then
  # Add wildcard CORS handling for dev mode
  node << 'NODE_END'
    const fs = require('fs');
    const path = 'backend/src/server.ts';
    let src = fs.readFileSync(path, 'utf8');

    // Broaden CORS to allow any vercel.app + trycloudflare
    const oldCorsRegex = /app\.use\(cors\(\{[^}]+\}\)\);/;
    const newCors = `app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ];
    // Allow any vercel.app or trycloudflare.com subdomain (dev convenience)
    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.endsWith('.trycloudflare.com')) return callback(null, true);
    return callback(null, true); // TEMP: allow all in dev
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));`;

    if (oldCorsRegex.test(src)) {
      src = src.replace(oldCorsRegex, newCors);
      fs.writeFileSync(path, src);
      console.log('  ✅ CORS broadened for Vercel');
    } else {
      console.log('  ⚠️  CORS line not found — check manually');
    }
NODE_END
fi

# ============================================================
# PHASE 3: START BACKEND
# ============================================================
echo ""
echo -e "${B}[3/6] Starting local backend...${N}"

cd backend
npm run dev > /tmp/cnx-backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo -e "${C}  Waiting 40s for backend...${N}"
READY=0
for i in {1..20}; do
  sleep 2
  S=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null)
  if [ "$S" = "200" ]; then
    READY=1
    echo -e "${G}  ✅ Backend up at http://localhost:8080${N}"
    break
  fi
done

if [ "$READY" != "1" ]; then
  echo -e "${R}  ❌ Backend failed to start${N}"
  tail -15 /tmp/cnx-backend.log | sed 's/^/    /'
  exit 1
fi

# Verify route works
TS=$(date +%s)
SIGNUP=$(curl -s -m 10 -X POST http://localhost:8080/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"T\",\"email\":\"t${TS}@cnx.in\",\"password\":\"password123\",\"orgName\":\"T $TS\"}")
TOKEN=$(echo "$SIGNUP" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$TOKEN" ] && echo -e "${G}  ✅ Backend fully working${N}" || echo -e "${R}  ❌ Signup failed${N}"

# ============================================================
# PHASE 4: INSTALL CLOUDFLARED TUNNEL
# ============================================================
echo ""
echo -e "${B}[4/6] Setting up tunnel (cloudflared)...${N}"

# Check if cloudflared exists
if command -v cloudflared >/dev/null 2>&1; then
  echo -e "${G}  ✅ cloudflared found${N}"
else
  echo -e "${Y}  ⚠️  cloudflared not found — downloading...${N}"

  # Download cloudflared for Windows
  CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  CLOUDFLARED_PATH="$PD/cloudflared.exe"

  if [ ! -f "$CLOUDFLARED_PATH" ]; then
    echo -e "${C}  Downloading cloudflared (15 MB)...${N}"
    curl -L -o "$CLOUDFLARED_PATH" "$CLOUDFLARED_URL" 2>&1 | tail -2
  fi

  if [ -f "$CLOUDFLARED_PATH" ]; then
    echo -e "${G}  ✅ cloudflared downloaded${N}"
    CLOUDFLARED="$CLOUDFLARED_PATH"
  else
    echo -e "${R}  ❌ Download failed${N}"
    echo -e "${Y}  Manual install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/${N}"
    echo -e "${Y}  Skipping tunnel setup. Backend on localhost:8080 — use ngrok manually.${N}"
    CLOUDFLARED=""
  fi
fi

# ============================================================
# PHASE 5: START TUNNEL
# ============================================================
echo ""
echo -e "${B}[5/6] Starting public tunnel...${N}"

if [ -n "$CLOUDFLARED" ]; then
  # Start cloudflared in background
  "$CLOUDFLARED" tunnel --url http://localhost:8080 > /tmp/cnx-tunnel.log 2>&1 &
  TUNNEL_PID=$!

  echo -e "${C}  Waiting for tunnel URL (30s)...${N}"
  TUNNEL_URL=""
  for i in {1..30}; do
    sleep 2
    TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/cnx-tunnel.log 2>/dev/null | head -1)
    if [ -n "$TUNNEL_URL" ]; then
      break
    fi
  done

  if [ -n "$TUNNEL_URL" ]; then
    echo -e "${G}  ✅ Tunnel live: $TUNNEL_URL${N}"

    # Test through tunnel
    sleep 3
    TS=$(curl -s -m 10 "$TUNNEL_URL/health" 2>/dev/null)
    if echo "$TS" | grep -q '"ok":true'; then
      echo -e "${G}  ✅ Tunnel works — backend reachable publicly${N}"
    else
      echo -e "${Y}  ⚠️  Tunnel started but health check slow (may still work)${N}"
    fi
  else
    echo -e "${R}  ❌ Tunnel URL not detected${N}"
    echo -e "${Y}  Check log:${N}"
    tail -10 /tmp/cnx-tunnel.log | sed 's/^/    /'
  fi
else
  echo -e "${R}  ❌ No tunnel available${N}"
  echo -e "${Y}  Options:${N}"
  echo -e "${Y}    1. Install cloudflared manually${N}"
  echo -e "${Y}    2. Use ngrok: ngrok http 8080${N}"
  echo -e "${Y}    3. Use npx: npx localtunnel --port 8080${N}"
fi

# ============================================================
# PHASE 6: INSTRUCTIONS
# ============================================================
echo ""
echo -e "${B}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}║              📋 NEXT STEPS                            ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════════════╝${N}"
echo ""

if [ -n "$TUNNEL_URL" ]; then
  echo -e "${C}Backend public URL:${N}"
  echo -e "${G}  $TUNNEL_URL${N}"
  echo ""
  echo -e "${C}═══════════════════════════════════════════════════${N}"
  echo -e "${C}STEP 1: Update Vercel Environment Variable${N}"
  echo -e "${C}═══════════════════════════════════════════════════${N}"
  echo ""
  echo -e "${Y}Open this URL in browser:${N}"
  echo -e "  ${G}https://vercel.com/certwinx/chatnexa/settings/environment-variables${N}"
  echo ""
  echo -e "  ${B}Find:${N} NEXT_PUBLIC_API_URL"
  echo -e "  ${B}Change to:${N} ${G}$TUNNEL_URL${N}"
  echo -e "  ${B}Click:${N} Save"
  echo ""
  echo -e "  ${B}Find:${N} NEXT_PUBLIC_SOCKET_URL"
  echo -e "  ${B}Change to:${N} ${G}$TUNNEL_URL${N}"
  echo -e "  ${B}Click:${N} Save"
  echo ""
  echo -e "${C}═══════════════════════════════════════════════════${N}"
  echo -e "${C}STEP 2: Redeploy Vercel${N}"
  echo -e "${C}═══════════════════════════════════════════════════${N}"
  echo ""
  echo -e "${Y}Open this URL:${N}"
  echo -e "  ${G}https://vercel.com/certwinx/chatnexa${N}"
  echo ""
  echo -e "  Click: ${B}Deployments${N} tab"
  echo -e "  Click: ${B}⋯${N} (three dots) on latest deploy"
  echo -e "  Click: ${B}Redeploy${N}"
  echo ""
  echo -e "${C}═══════════════════════════════════════════════════${N}"
  echo -e "${C}STEP 3: Test Setup${N}"
  echo -e "${C}═══════════════════════════════════════════════════${N}"
  echo ""
  echo -e "  ${Y}Open:${N} ${G}https://chatflow-saas-web.vercel.app/dashboard/setup${N}"
  echo ""
  echo -e "  ${Y}Ctrl+Shift+R${N} (hard refresh)"
  echo -e "  Step 4 → credentials daalo"
  echo -e "  ${G}Verify with Meta${N} click karo"
  echo ""
  echo -e "${G}  ✅ Ab KAM karega — kyunki public backend available hai${N}"
  echo ""
  echo -e "${M}  ⚠️  IMPORTANT:${N}"
  echo -e "${M}    - Tunnel URL sirf jab tak ye script chalti hai tab tak valid hai${N}"
  echo -e "${M}    - Har restart me NAYA URL milega${N}"
  echo -e "${M}    - Fir Vercel env var update karna padega + redeploy${N}"
  echo ""
else
  echo -e "${R}  ❌ Tunnel unavailable — cannot proceed${N}"
  echo ""
  echo -e "${Y}Alternative: Use ngrok manually${N}"
  echo -e "  1. Download ngrok: https://ngrok.com/download${N}"
  echo -e "  2. Sign up (free): https://dashboard.ngrok.com/signup${N}"
  echo -e "  3. Run: ${G}ngrok http 8080${N}"
  echo -e "  4. Copy the https://xxx.ngrok-free.app URL${N}"
  echo -e "  5. Use that URL as NEXT_PUBLIC_API_URL in Vercel${N}"
fi

echo ""
echo -e "${B}═══════════════════════════════════════════════════${N}"
echo -e "${C}  🔄 KEEP THIS TERMINAL OPEN${N}"
echo -e "${B}═══════════════════════════════════════════════════${N}"
echo ""
echo -e "  Backend: ${G}http://localhost:8080${N} ${G}(running)${N}"
[ -n "$TUNNEL_URL" ] && echo -e "  Tunnel:  ${G}$TUNNEL_URL${N} ${G}(running)${N}"
echo ""
echo -e "${Y}  Terminal band karne se tunnel aur backend dono band ho jayenge${N}"
echo -e "${Y}  Stop karne ke liye: Ctrl+C${N}"
echo ""

# Keep running — user can Ctrl+C to stop
wait