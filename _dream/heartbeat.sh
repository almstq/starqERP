#!/bin/bash
# Phase A — heartbeat script for starqERP dream pipeline validation.
# Proves a cron job can complete in the isolated session WITHOUT depending
# on the LLM provider. If this fails, the problem is pipeline/infra, not the prompt.

set -euo pipefail

WKDIR="/d/!starq/starqERP"
DREAM_DIR="$WKDIR/_dream"
OUTFILE="$DREAM_DIR/overnight-dream-heartbeat.md"

mkdir -p "$DREAM_DIR"

# 1. HEAD
HEAD=$(git -C "$WKDIR" rev-parse HEAD 2>/dev/null || echo "UNREADABLE")

# 2. board totals from SSOT via node
if command -v node >/dev/null 2>&1 && [ -f /d/!starq/starqNexus/data/starq-erp-tasks.json ]; then
  BOARD=$(node -e "
const s=require('/d/!starq/starqNexus/data/starq-erp-tasks.json');
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

# 3. latest broker sequence from bus tail
if [ -f /d/!starq/agent-comms/room.jsonl ]; then
  LAST_SEQ=$(tail -3 /d/!starq/agent-comms/room.jsonl | node -e "
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
