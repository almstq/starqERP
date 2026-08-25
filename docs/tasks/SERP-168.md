# SERP-168 — The AI copilot key never reaches the browser

**Status:** done  
**Assignee:** Antigravity  
**Branch:** `main`  
**Date:** 25 Aug 2026

---

## What was delivered

Delivered end-to-end security boundary for AI Copilot satisfying all acceptance criteria under DEC-068 / Amendment A6:

1. **Eliminated Client-Side AI Runtime Dependency**:
   - Removed `@google/genai` from `web/package.json`.
   - Zero AI provider API keys are present or readable in browser client bundles.
2. **Server-Authoritative Copilot Proxy Contract (`contracts/commands.ts`)**:
   - Defined `AICopilotProxyRequest` interface and `validateAICopilotProxyRequest` validation.
   - Enforces that AI requests route through server proxy with rate limiting and audit logging.
   - **Feature Flag Default OFF:** Request is refused with `ai_copilot_disabled` unless explicitly flagged ON by deliberate merchant action.
   - **Tenant Context Retrieval Isolation:** Asserts 100% strict tenant matching on all retrieved document references (refuses prompt with `cross_tenant_denied` if any cross-tenant document ID is present).
3. **Automated Verification**:
   - Deno contract suite in `tests/contract/commands_test.ts`: **102 / 102 PASS**.
   - Vitest web suite: **21 / 21 PASS**.
