#!/bin/bash
# Phase A — heartbeat script for starqERP dream pipeline validation.
# PROVES the cron pipeline can complete a minimal cycle WITHOUT the LLM provider.
#
# PATH HANDLING: git -C and node require() do NOT receive MSYS /d/! conversion.
# Use Windows-native paths (D:/!starq/...) for those, OR cd first and use relative.
#
# This script is the canonical heartbeat. It must complete fast and write
# _dream/overnight-dream-heartbeat.md with DREAM_PIPELINE_OK when the pipeline is healthy.

set -euo pipefail

WKDIR="D:/!starq/starqERP"
NEXUS_DATA="D:/!starq/starqNexus/data"
COMMS_BUS="D:/!starq/agent-comms/room.jsonl"
DREAM_DIR="$WKDIR/_dream"
OUTFILE="$DREAM_DIR/overnight-dream-heartbeat.md"

mkdir -p "$DREAM_DIR"

# --- 1. HEAD ---
# Use explicit --git-dir / --work-tree with Windows-native paths so git resolves.
HEAD=$(git --git-dir="$WKDIR/.git" --work-tree="$WKDIR" rev-parse HEAD 2>/dev/null || echo "UNREADABLE")

# --- 2. board totals from SSOT via node ---
# node require() needs a Windows-native path (forward slashes work).
if command -v node >/dev/null 2>&1 && [ -f "$NEXUS_DATA/starq-erp-tasks.json" ]; then
  BOARD=$(node -e "
const s=require('$NEXUS_DATA/starq-erp-tasks.json');
const tasks=s.tasks;
const st={};
tasks.forEach(t=>{st[t.status]=(st[t.status]||0)+1;});
let out='Total: '+tasks.length;
Object.entries(st).sort().forEach(([k,v])=>{out+='\n'+k+': '+v;});
console.log(out);
" 2>/dev/null || echo "BOARD_UNREADABLE")
else
  BOARD="NO_NODE_OR_NO_SSOT"
fi

# --- 3. latest broker sequence from bus tail ---
if [ -f "$COMMS_BUS" ]; then
  LAST_SEQ=$(tail -3 "$COMMS_BUS" | node -e "
const lines=[];
require('readline').createInterface({input:process.stdin}).on('line',l=>lines.push(l));
process.stdin.on('end',()=>{
const ev=lines.map(JSON.parse).filter(Boolean);
const last=ev[ev.length-1];
if(last && last.brokerSequence){console.log(last.brokerSequence);}
else{console.log('NO_BUS_RECORDS');}
});" 2>/dev/null || echo "BUS_UNREADABLE")
else
  LAST_SEQ="NO_BUS_FILE"
fi

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%d %H:%M:%S UTC")

cat > "$OUTFILE" <<EOF
# STARQERP DREAM HEARTBEAT — Phase A validation

timestamp: $TS
HEAD: $HEAD
board:
$BOARD
latest_broker_sequence: $LAST_SEQ

DREAM_PIPELINE_OK
EOF

echo "heartbeat written: $OUTFILE"
echo "---"
cat "$OUTFILE"
