PHASE A — HEARTBEAT DREAM. Prove the cron pipeline can complete one minimal cycle.

TASK (do exactly this, nothing more):
1. Read current starqERP HEAD: cd /d/!starq/starqERP && git rev-parse HEAD
2. Read current starqERP board totals from the Nexus SSOT:
   node -e "const s=require('/d/!starq/starqNexus/data/starq-erp-tasks.json'); const tasks=s.tasks; const st={}; tasks.forEach(t=>{st[t.status]=(st[t.status]||0)+1;}); console.log('Total:',tasks.length); Object.entries(st).sort().forEach(([k,v])=>console.log(k+':'+v));"
3. Read latest broker sequence from the Nexus bus tail:
   tail -3 /d/!starq/agent-comms/room.jsonl | node -e "const lines=[];require('readline').createInterface({input:process.stdin}).on('line',l=>lines.push(l));process.stdin.on('end',()=>{const ev=lines.map(JSON.parse).filter(Boolean);const last=ev[ev.length-1];if(last){console.log('brokerSequence:',last.brokerSequence);console.log('sender:',last.event.senderHandle);console.log('type:',last.event.type);}else{console.log('no records');}})"
4. Write _dream/dream-heartbeat.md containing exactly:
   - timestamp (current UTC ISO)
   - HEAD
   - board totals (total + status breakdown)
   - latest broker sequence observed
   - DREAM_PIPELINE_OK

OUTPUT PATH: /d/!starq/starqERP/_dream/dream-heartbeat.md
CREATE the _dream dir if needed.

DO NOT:
- read individual SERP cards
- reconcile anything
- investigate worktrees
- analyze architecture
- load historical context
- mutate ERP/Nexus/SSOT/git/board/branch/config/deployment state

This is a pipeline smoke test only.
