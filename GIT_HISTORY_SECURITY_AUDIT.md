# starqERP — Git History Security & Sanitization Audit
**Audit Scope**: Entire Git commit history from initial commit to `HEAD`  
**Date**: 2026-08-27  
**Tooling**: Custom AST and regex scanner (`scripts/audit_repo_secrets.mjs`) + `git log -p` deep inspection  

---

## 1. Summary of History Findings

| Category | Finding Count | Risk Level | Description |
| :--- | :--- | :--- | :--- |
| **Supabase Service Keys** | 0 | ✅ CLEAN | No live `SUPABASE_SERVICE_ROLE_KEY` or production JWTs were ever committed to Git. |
| **Private Keys (RSA/EC)** | 0 | ✅ CLEAN | No private TLS certificates or SSH private keys found in history. |
| **Google OAuth Client Secrets** | 0 | ✅ CLEAN | No `GOCSPX-...` client secrets were committed. |
| **Google OAuth Client IDs** | 6 | ⚠️ LOW | Staging/Web client IDs (`901212915429-*.apps.googleusercontent.com`) in past commits. |
| **Supabase Staging Endpoints** | 11 | ⚠️ LOW | Staging URL `wthabguvueewgtabjsdo.supabase.co` referenced in past documentation and Vite proxy. |
| **Developer Personal Emails** | 212 | 🔴 MEDIUM | Personal email addresses (`a.musthaq@gmail.com`, `starq.sys@gmail.com`, `nashidh3566@gmail.com`, `naleeeez@gmail.com`) across commit authors and allowlist seeds. |
| **Synthetic Test Passwords** | 11 | ℹ️ BENIGN | Synthetic probe passwords (e.g. `synthetic-serp176-only`) in isolated integration test scripts. |
| **Real Customer / PII Data** | 0 | ✅ CLEAN | Customer records in seed data use synthetic names (e.g. "Ahmed Naseer", "Ibrahim Rasheed"). |

---

## 2. In-Depth Analysis: Why Deleting from HEAD is Insufficient

In Git, every commit object is cryptographically chained to its parent by SHA-1/SHA-256 hashes. 
Even if a sensitive string, developer email, or internal document is removed in a later commit:
1. **Full History Remains Queryable**: Anyone cloning the repository can run `git log -p` or `git checkout <old-sha>` to inspect previous versions of files.
2. **Commit Author Metadata**: Git commits retain author emails in immutable commit headers.
3. **Internal Architecture Leaks**: Deleted internal agent records and commercial audits remain viewable in previous tree objects.

---

## 3. Sanitization & Publication Strategy Comparison

### Option 1: Clean-Room Public Release Repository (RECOMMENDED)
- **Mechanism**:
  1. Create a clean snapshot of sanitized HEAD files (following `PUBLIC_FILE_MANIFEST.md`).
  2. Initialize a fresh Git repository (`git init`) in a release directory.
  3. Author with a generic organization bot identity (e.g. `Starq Technologies Core Team <dev@starq.mv>`).
  4. Create initial release commit `feat: initial public release of starqERP v0.2.0-beta`.
  5. Push to new public GitHub repository `almstq/starqERP` (or rename private repo to `starqERP-internal`).
- **Benefits**:
  - 100% guarantee that zero historical baggage, personal emails, or deleted drafts leak.
  - Zero risk of damaging internal development history.
  - Clean, professional release history for external developers.

### Option 2: Git History Rewrite via `git-filter-repo`
- **Mechanism**:
  1. Use `git-filter-repo --mailmap` to rewrite all author emails to `dev@starq.mv`.
  2. Run `git-filter-repo --replace-text` to sanitize URLs and sensitive tokens.
  3. Purge unreachable objects:
     ```bash
     git reflog expire --expire=now --all
     git gc --prune=now --aggressive
     ```
  4. Force-push rewritten branches to GitHub.
- **Risks**:
  - Destructive to commit hashes, tags, and PR references.
  - Potential for missed edge-case blobs without extensive re-auditing.

---

## 4. Immediate Action Items
1. Cleanse HEAD files according to `PUBLIC_FILE_MANIFEST.md` and `README_PUBLIC_DRAFT.md`.
2. Do not change repository visibility to public on GitHub until the Clean-Room repository is prepared and signed off by the Founder.
