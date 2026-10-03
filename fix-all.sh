#!/usr/bin/env bash
# ============================================================
#  ChatNexa Fix-All Script
#  Fixes: send-time.ts syntax error + restart backend
# ============================================================
set -euo pipefail

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; N='\033[0m'

echo ""
echo -e "${B}╔═══════════════════════════════════════════════╗${N}"
echo -e "${B}║   🔧 ChatNexa Fix-All Script                  ║${N}"
echo -e "${B}╚═══════════════════════════════════════════════╝${N}"
echo ""

# Auto-detect project root
if [ -d "./backend" ] && [ -d "./frontend" ]; then
  ROOT="."
elif [ -d "./chatnexa/backend" ]; then
  ROOT="./chatnexa"
else
  echo -e "${R}❌ Project root nahi mila${N}"
  echo "Chalao from chatnexa/ folder"
  exit 1
fi

echo -e "${C}📂 Project: $(cd $ROOT && pwd)${N}"
echo ""

# ============================================================
# STEP 1: Stop old processes
# ============================================================
echo -e "${B}[1/4] Stopping old processes...${N}"
taskkill //F //IM node.exe 2>/dev/null || pkill -f "tsx.*src/server" 2>/dev/null || true
sleep 2
echo -e "${G}✅ Old processes stopped${N}"

# ============================================================
# STEP 2: Fix send-time.ts
# ============================================================
echo -e "${B}[2/4] Fixing send-time.ts...${N}"

cat > "$ROOT/backend/src/services/send-time.ts" << 'END'
import { many } from '../db/pool';

const DEFAULT_BY_TAG: Record<string, number> = {
  business_owner: 10,
  professional: 20,
  student: 21,
  housewife: 11,
  default: 11,
};

export const sendTime = {
  bestHourFor(contact: any): number {
    if (contact?.preferred_send_hour != null) return contact.preferred_send_hour;

    const tags: string[] = (contact?.tags || []).map((t: string) => String(t).toLowerCase());
    for (const tag of tags) {
      for (const key of Object.keys(DEFAULT_BY_TAG)) {
        if (key !== 'default' && tag.includes(key)) return DEFAULT_BY_TAG[key];
      }
    }
    return DEFAULT_BY_TAG.default;
  },

  async groupByHour(orgId: string, contactIds: string[]) {
    const contacts = await many<any>(
      `SELECT id, tags, preferred_send_hour FROM contacts WHERE org_id = $1 AND id = ANY($2::uuid[])`,
      [orgId, contactIds]
    );

    const groups: Record<number, string[]> = {};
    for (const c of contacts) {
      const hour = this.bestHourFor(c);
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push(c.id);
    }
    return groups;
  },
};
END

# Verify
if grep -q "const DEFAULT_BY_TAG: Record" "$ROOT/backend/src/services/send-time.ts" && ! grep -q "DEFAULT_BY_TAG: Record<string, number> = {" "$ROOT/backend/src/services/send-time.ts"; then
  echo -e "${G}✅ send-time.ts fixed${N}"
else
  echo -e "${R}❌ Fix failed — check manually${N}"
  exit 1
fi

# ============================================================
# STEP 3: Clear caches
# ============================================================
echo -e "${B}[3/4] Clearing caches...${N}"
rm -rf "$ROOT/backend/dist" "$ROOT/frontend/.next" 2>/dev/null || true
echo -e "${G}✅ Caches cleared${N}"

# ============================================================
# STEP 4: Restart backend
# ============================================================
echo -e "${B}[4/4] Starting backend...${N}"
echo ""
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo -e "${C}  Starting: npm run dev${N}"
echo -e "${C}  Wait for: ✅ postgres connected${N}"
echo -e "${C}  Press Ctrl+C to stop${N}"
echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo ""

cd "$ROOT"
exec npm run dev