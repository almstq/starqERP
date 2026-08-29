DREAM OVER STARQERP — READ-ONLY RECONCILIATION MODE.

This is memory consolidation and project familiarization ONLY. You are NOT executing any ERP work. You are observing, comparing, consolidating, and remembering.

HARD CONSTRAINTS (non-negotiable):
- NO code changes, commits, branch switching, task claiming, board mutation, migrations, deployment, credentials/config changes, pushing/merging, or marking tasks done/blocked.
- NO rewriting SSOT to make contradictions disappear.
- NO file modifications except writing your dream record to the designated output path below.

SOURCE PRECEDENCE (highest to lowest):
1. Current filesystem and repositories: git status, git log, git branch -a, git worktree list, HEAD vs origin/main, file tree.
2. Current Nexus/ERP SSOT: starqNexus/data/starq-erp-tasks.json (task board), profile.json (Founder identity), orgs.json (org roster), duty-roster.json (agent availability), work-logs.json (daily logs).
3. Current handoffs and comms bus: agent-comms/room.jsonl (recent broker events by brokerSequence), agent-comms/inbox/.
4. Git and worktree evidence: commit history, branch population, worktree states, uncommitted changes.
5. Historical and session memory: may explain current state but must NEVER overrule newer durable evidence.

If evidence conflicts, preserve the conflict rather than resolving it by assumption. Identify the competing evidence and leave mutation to the appropriate owner or Founder decision.

READ THE FOLLOWING:

1. StarqERP git state (from /d/!starq/starqERP):
   git status --short
   git log --oneline -20
   git branch -a
   git worktree list
   git rev-parse HEAD origin/main

2. SSOT board (/d/!starq/starqNexus/data/starq-erp-tasks.json):
   Total task count. Status breakdown (done, in_progress, blocked, planned, todo). All in_progress and blocked tasks with their owners, depends_on, and blocked_by. Recent completions and their commit hashes.

3. SSOT context files:
   /d/!starq/starqNexus/data/profile.json — Founder identity (note: known_as field)
   /d/!starq/starqNexus/data/orgs.json — organization roster
   /d/!starq/starqNexus/data/duty-roster.json — agent availability and assignments
   /d/!starq/starqNexus/data/work-logs.json — daily work logs

4. Comms bus tail (/d/!starq/agent-comms/room.jsonl):
   Read the last approximately 30 entries by brokerSequence. Identify senders, task IDs, action types (CLAIM, DONE, BLOCKED, MESSAGE, etc.), and any Founder directives. Note any contradictions between bus reports and SSOT state.

5. Project context files (from workdir /d/!starq/starqERP):
   Read CLAUDE.md, AGENTS.md, README.md, and any other context files if they exist.

6. Key SSOT task cards:
   Locate and read the full task objects for: SERP-173, SERP-125, SERP-124, SERP-286, SERP-287, SERP-288, SERP-289, SERP-300, SERP-328, SERP-014. Note their status, owners, depends_on, blocked_by, commits, and acceptance criteria.

CONSOLIDATE THE FOLLOWING:

- What materially changed since the last dream run. Compare current evidence with the previous dream record at /d/!starq/starqERP/_dream/overnight-dream-latest.md if it exists.
- Recurring architecture and workflow patterns observed across the project.
- Resolved versus unresolved contradictions (board vs bus vs git vs SSOT).
- Stale and superseded assumptions that should be discarded.
- Board, bus, git, and worktree divergences that need attention.
- Important dependencies and task relationships (depends_on chains, blocked_by relationships, task grouping).
- Lessons that should survive context loss across sessions.
- Items requiring Founder or worker attention tomorrow.

OUTPUT:

Write your consolidation to /d/!starq/starqERP/_dream/overnight-dream-latest.md. Create the _dream directory if it does not exist.

Each run should UPDATE this file cumulatively. Read the existing file first (if it exists), then produce an updated version that incorporates both the previous consolidation and your new observations. Do not discard previous content — build on it.

Use this structure:

# STARQERP OVERNIGHT DREAM — [DATE] [TIME] MVT

## CURRENT VERIFIED STATE
- Board totals and status breakdown
- Active WIP (in_progress tasks with owners)
- Git HEAD, origin/main divergence, branch and worktree census
- SSOT contradictions detected

## WHAT CHANGED SINCE LAST RUN
- Evidence-based changes only. Cite task IDs, commit hashes, and broker sequence numbers where relevant.

## PATTERNS AND LESSONS CONSOLIDATED
- Architecture patterns, workflow patterns, recurring failure patterns
- Dependencies and task relationships worth remembering

## STALE MEMORY REMOVED
- Assumptions discarded because newer evidence contradicts them. Cite the conflicting evidence.

## UNRESOLVED RECONCILIATION DEBT
- Each item: what the conflict is, what the competing evidence is, who owns resolution. Do not resolve by assumption.

## SAFE NEXT ACTION
- Observations only. Do NOT turn these into actions. What the team should look at tomorrow.

This is memory consolidation only. Do not execute. Do not modify ERP state. Do not modify files except the dream record at the output path above.
