# STARQ ERP Repository Repositioning Proposal

**Prepared by:** DP (WSL Hermes; bus ID `hermes`)
**Date:** 2026-08-20
**Scope:** Repository structure, README, and public positioning
**Boundary:** Proposal only. No git changes until explicit approval.

---

## 1. Current State Analysis

### Git Status (HEAD `b6e7450`)
- **110 files changed**, 9311 insertions, 6335 deletions
- Major changes: `serve.py` (+3463/-), `starq-ops-app/` (Flutter rebuild with new icons/assets), `ops.py` (+586), `ops/catalog/accountability.json` (+752)
- Untracked: `docs/`, `HANDOVER-2026-08-19.md`, `journal_outbox.py`, `masters.py`, `scratch/`, `scripts/`, `supabase/`, multiple test files, `pos.py`, `progress.json`
- **Binary changes:** Flutter app icons, iOS/Android build artifacts, Gradle/xcproj changes

### Current README Problems

| Issue | Evidence |
|---|---|
| **Company-specific naming** | Title: "the foundation engine" (not STARQ ERP) |
| **Company details in public doc** | Registry codes (C29552026, C30222026), BAR numbers (BP84562026, BP89422026, BP86372026), ISIC codes, MED references |
| **Occupancy/access law in README** | Trial user #0/#1, Gmail references, `_secrets` paths, Rule 0 D:-only |
| **Financial account detail** | Full chart of accounts with specific account numbers, BAR/ISIC mappings, GST registration status |
| **Internal operations doc** | Journals folder structure, vault paths, `books.py` commands, entity-specific posting rules |
| **No ERP positioning** | Describes "small accounting/operations core" not "ERP development" |
| **Flutter = CI paint shop** | Explicitly says "Not a finished Flutter app", "CI paint-shop sim" |

### Repo Structure Issues

| Issue | Evidence |
|---|---|
| **No public-facing entry point** | `serve.py` is Python HTTP server; no `README.md` for ERP developers |
| **Test files in root** | 15+ `test_*.py` files in repo root |
| **Internal ops files tracked** | `ops/_*.txt` draft emails, domain notes, port-in forms |
| **Flutter build artifacts** | iOS/Android build directories, `.xcworkspace`, `pubspec.lock` |
| **Secrets pattern in `.gitignore`** | `starqBooks.env.example` exists but `_secrets/` not ignored |
| **Supabase migrations in repo** | `supabase/migrations/` with company-seeded data (Club Ignition ID hardcoded) |

---

## 2. Proposed Repositioning

### Target Positioning

> **STARQ ERP** — A modular, AI-native, multi-tenant ERP platform for service operations, commerce, and finance. Built on a controlled main base with tenant isolation, audit trails, and governed AI leverage. Open development; production deployments are private.

### Repository Structure Changes

```
starq-erp/                    # REPO ROOT (rename from the foundation engine)
├── .github/
│   ├── workflows/            # CI: lint, test, typecheck, build
│   └── ISSUE_TEMPLATE/       # Bug, feature, security templates
├── docs/
│   ├── architecture/         # M0-M9 module specs, API contracts
│   ├── development/          # Local dev, testing, contribution guide
│   └── deployment/           # Self-hosted deployment guide (no cloud specifics)
├── erp-core/                 # Python portal (renamed from serve.py root)
│   ├── erp_core/             # Package: auth, seats, entities, journals, ops
│   ├── api/                  # HTTP routes, middleware, validation
│   ├── cli/                  # books.py, catalog.py, migrate.py
│   ├── tests/                # pytest suite (unit + contract)
│   └── pyproject.toml        # Modern Python packaging
├── flutter-client/           # starq-ops-app → flutter-client
│   ├── lib/                  # Features, core, shared
│   ├── test/                 # Flutter test suite
│   └── pubspec.yaml
├── supabase/                 # Migrations only (no seeds, no project refs)
│   ├── migrations/           # 0001-0008 (generic, no company data)
│   ├── seed.sql              # Synthetic/dev seed only
│   └── local-dev.md          # Local Supabase setup
├── scripts/                  # Build, lint, generate, dev helpers
├── .gitignore                # Comprehensive: venv, _secrets, vault, build artifacts
├── .env.example              # Template only
├── LICENSE                   # MIT or similar
├── CONTRIBUTING.md           # Development workflow, coding standards
├── SECURITY.md               # Vulnerability disclosure
├── CHANGELOG.md              # Keep a changelog
└── README.md                 # Public-facing ERP project README
```

### Files to Remove from Git Tracking

| Pattern | Reason |
|---|---|
| `ops/_*.txt` | Internal draft emails, domain notes |
| `ops/_domain-starq-mv.txt` | Internal domain notes |
| `ops/_fill_portin_form.py` | One-off script |
| `ops/_nexus-*.txt` | Internal Nexus comparison |
| `ops/_portin-form-fields-dump.txt` | Form dump |
| `ops/masters/` | Runtime data, not source |
| `scratch/` | Scratch workspace |
| `pos.py` | Legacy/unused |
| `progress.json` | Runtime state |
| `journal_outbox.py` | Internal module |
| `masters.py` | Internal module |
| `starqBooks.env.example` | Renamed to `.env.example` |
| `HANDOVER-*.md` | Internal handover |
| `ACCESS.md` | Internal access law |
| `ERP-READY-CORE.md` | Internal spec (move to docs/architecture) |
| `ORG-REGISTRY.md` | Internal registry |
| `supabase/.temp/` | Local Supabase state |
| `supabase/seed.sql` | Contains company data → replace with synthetic |
| Flutter `build/`, `.dart_tool/`, `pubspec.lock` | Build artifacts |

---

## 3. Proposed README.md (Public-Facing)

```markdown
# STARQ ERP

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://python.org)
[![Flutter](https://img.shields.io/badge/flutter-3.24%2B-blue.svg)](https://flutter.dev)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16%2B-blue.svg)](https://postgresql.org)

**STARQ ERP** is a modular, AI-native, multi-tenant ERP platform for service operations, commerce, and finance. Built on a controlled main base with tenant isolation, audit trails, and governed AI leverage.

> **Status:** Active development. Production deployments are private. This repository contains the development source; self-hosted deployment is documented for evaluation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    STARQ ERP Platform                       │
├─────────────────────────────────────────────────────────────┤
│  Python Portal (erp-core)    │  Flutter Client (flutter)    │
│  • Multi-tenant auth/seats   │  • Field/service operations  │
│  • Journals/GL engine        │  • Offline-first sync        │
│  • Ops events & audit        │  • Counter/cash sessions     │
│  • REST API + WebSocket      │  • Mobile/desktop/web        │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  PostgreSQL       │
                    │  • RLS + tenant   │
                    │  • Idempotency    │
                    │  • Audit events   │
                    └───────────────────┘
```

### Module Ladder (M0–M9)

| Phase | Modules | Status |
|---|---|---|
| **R0** | Cloud-client preflight (M0) | In progress |
| **R1** | M0 Main base + M1 Organisation | Planned |
| **R2** | M2 Service, M3 Commercial, M4 Stock | Planned |
| **R3** | M5 Finance (financial consequence) | Planned |
| **R4** | M8 AI Control Plane (A0/A1) | Planned |
| **R5** | External onboarding | Planned |
| **R6+** | M6 Counter, M7 Management, M9 Extended | Planned |

See [docs/architecture/MODULE_LADDER.md](docs/architecture/MODULE_LADDER.md) for full specification.

## Quick Start (Development)

### Prerequisites
- Python 3.12+
- Flutter 3.24+ / Dart 3.5+
- PostgreSQL 16+ (or Supabase local)
- Docker (optional, for Supabase local)

### Python Portal
```bash
cd erp-core
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # Edit with local values
erp-core migrate       # Run migrations
erp-core dev           # Starts on http://127.0.0.1:8000
```

### Flutter Client
```bash
cd flutter-client
flutter pub get
flutter run -d chrome   # or android/ios/macos/windows/linux
```

### Supabase Local (Optional)
```bash
cd supabase
docker compose up -d    # Starts local Supabase stack
# Apply migrations:
supabase db reset --local
```

## Documentation

| Document | Description |
|---|---|
| [Architecture Overview](docs/architecture/OVERVIEW.md) | System design, trust boundaries, data flow |
| [API Contracts](docs/architecture/API_CONTRACTS.md) | REST endpoints, schemas, idempotency, errors |
| [Module Specifications](docs/architecture/MODULES/) | M0–M9 detailed specs |
| [Development Guide](docs/development/DEVELOPMENT.md) | Local setup, testing, coding standards |
| [Deployment Guide](docs/deployment/SELF_HOSTED.md) | Self-hosted deployment (no cloud specifics) |
| [Contributing](CONTRIBUTING.md) | Code style, PR process, testing requirements |
| [Security](SECURITY.md) | Vulnerability disclosure, threat model |

## Key Principles

- **Tenant isolation first** — Every query/mutation is tenant-scoped; cross-tenant access denied by default
- **Audit everything** — Immutable event log for every state change; no silent overwrites
- **AI observes, humans decide** — Agents propose; deterministic code authorizes; no NL execution
- **Idempotency by default** — Every mutating command carries a client-generated key; replay is safe
- **No secrets in repo** — `.env.example` only; production secrets via platform secret manager
- **Self-hostable** — No mandatory cloud services; Supabase/PostgreSQL interchangeable

## License

MIT License — see [LICENSE](LICENSE) for details.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability disclosure and our threat model.

## Community

This is an open development repository. Production deployments by STARQ Technologies are private. Issues and PRs welcome per [CONTRIBUTING.md](CONTRIBUTING.md).

---

*STARQ ERP — Modular. Auditable. AI-governed.*
```

---

## 4. Proposed `.gitignore` (Comprehensive)

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
.venv/
venv/
.env
.env.*
!.env.example
.pytest_cache/
.coverage
htmlcov/
*.egg-info/
dist/
build/

# Flutter/Dart
.dart_tool/
.pub/
build/
*.dart_tool/
flutter_*.jar
*.lock
pubspec.lock

# IDE/Editor
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Supabase / Database
supabase/.temp/
supabase/.branches/
*.db
*.sqlite
*.sqlite3

# Secrets & Vault
_secrets/
vault/
journals/
_git-remotes/
*.pem
*.key
*.crt
*_secrets*

# Build artifacts
*.apk
*.aab
*.ipa
*.app
*.dmg
*.exe
*.msi
dist/
build/
*.xcarchive/

# Logs & Runtime
*.log
logs/
*.pid
*.sock

# OS
Thumbs.db
ehthumbs.db
Desktop.ini

# Test/Scratch
scratch/
*.tmp
*.temp
test-results/
coverage/
```

---

## 5. Migration Plan (If Approved)

| Step | Action | Risk |
|---|---|---|
| 1 | Create `starq-erp` repo (or rename) | Low — new remote |
| 2 | Restructure directories per §2 | Medium — path updates in imports |
| 3 | Move internal docs to `docs/architecture/` | Low |
| 4 | Rewrite README per §3 | Low |
| 5 | Update `.gitignore` per §4 | Low |
| 6 | Sanitize Supabase migrations (remove seeds) | Medium — verify migration integrity |
| 7 | Move internal ops files to vault/untracked | Low |
| 8 | Update Python package to `erp-core` | Medium — import path changes |
| 9 | Rename Flutter app to `flutter-client` | Medium — namespace changes |
| 10 | Add CI workflows (lint, test, typecheck) | Low |
| 11 | Tag `v0.1.0-dev` baseline | Low |

**Estimated effort:** 2–3 focused sessions. All changes are structural/refactoring — no logic changes.

---

## 6. Decision Request (with Recommendations)

**Founder decision required** — please confirm each:

| # | Decision | Recommendation | Action Required |
|---|---|---|---|
| 1 | **Rename repo** `legacy/engine` → `starq-erp`? | ✅ **Yes** — rename in place (preserves history/issues). Do NOT create new repo. | **Founder:** GitHub Settings → rename `starq-ops` → `starq-erp`. |
| 2 | **Public README** positioning? | ✅ **Approve** with one addition: "*Developed by STARQ Technologies. Production deployments by STARQ Technologies and Club Ignition are private.*" | **Founder:** Confirm or edit. |
| 3 | **Supabase migrations** — sanitize seeds? | ✅ **Yes** — keep schema/RLS/functions; replace `seed.sql` with synthetic; remove `.temp/`, `.branches/`, `linked-project.json` from git. | **Founder:** Confirm. |
| 4 | **Flutter rename** `starq-ops-app` → `flutter-client`? | ✅ **Yes** — namespace `flutter_client`, package `com.starq.erp.flutter`. Do in same PR. | **Founder:** Confirm. |
| 5 | **Python package** `erp-core` (modern `src/` layout)? | ✅ **Yes** — `pyproject.toml` + `src/erp_core/`, editable install, clean imports. | **Founder:** Confirm. |
| 6 | **Timeline** — batch in one PR? | ✅ **Yes** — single PR, atomic history, tag `v0.1.0-dev` after merge. | **Founder:** Confirm. |

**Next step on "go ahead":** Elder executes restructure locally per above; Codex reviews architectural alignment; Founder handles GitHub repo rename and approvals.

---

## 7. Explicit Task Assignment

### Elder (Claude Code) — Execute Restructure
**Scope:** All local code/repository restructuring per approved decisions.

**Tasks:**
- [ ] Restructure directories: `erp-core/`, `flutter-client/`, `supabase/`, `docs/architecture/`, `.github/workflows/`
- [ ] Modernize Python: `pyproject.toml`, `src/erp_core/` layout, fix all imports
- [ ] Rename Flutter: `starq-ops-app` → `flutter-client` (namespace `flutter_client`, package `com.starq.erp.flutter`)
- [ ] Sanitize Supabase: replace `seed.sql` with synthetic; remove `.temp/`, `.branches/`, `linked-project.json` from tracking
- [ ] Rewrite README: public STARQ ERP positioning per §3 (+ one-line attribution)
- [ ] Overhaul `.gitignore`: comprehensive per §4
- [ ] Move internal docs to `docs/architecture/`, `docs/development/`, `docs/deployment/`
- [ ] Remove tracked internal files: `ops/_*.txt`, `HANDOVER-*.md`, `ACCESS.md`, `ERP-READY-CORE.md`, `ORG-REGISTRY.md`, `scratch/`, `pos.py`, `progress.json`, `journal_outbox.py`, `masters.py`, `starqBooks.env.example`, `supabase/.temp/`, `supabase/seed.sql` (replace), Flutter `build/`, `.dart_tool/`, `pubspec.lock`, iOS/Android build artifacts
- [ ] Add CI workflows: lint, typecheck, test, build
- [ ] Run full validation: `npm run lint` (starqNexus), `flutter analyze`, `flutter test`, `pytest`, `deno test` (contract tests)
- [ ] Present final diff for Founder review before any push

**Boundary:** No GitHub repo rename, no cloud secrets, no Supabase dashboard, no PR merge. All local.

### Codex — Architectural Review
**Scope:** Review Elder's restructure for alignment with STARQ ERP architecture.

**Tasks:**
- [ ] Verify M0–M9 module boundaries preserved in new structure
- [ ] Confirm tenant isolation, audit, idempotency patterns unchanged
- [ ] Validate API contracts, error taxonomy, replay semantics intact
- [ ] Check AI governance boundaries (agents propose, deterministic code authorizes)
- [ ] Confirm Flutter client is a consumer of ERP API, not a second ledger
- [ ] Flag any architectural drift before Founder review

### Founder — Decisions & GitHub Actions
**Tasks:**
- [ ] **GitHub repo rename:** Settings → `starq-ops` → `starq-erp` (preserves history/issues/PRs)
- [ ] **Confirm 6 decisions** above (reply with "confirmed" or edits)
- [ ] **Update local remote** after rename: `git remote set-url origin git@github.com:almstq/starq-erp.git`
- [ ] **Review Elder's diff** and approve push
- [ ] **Merge PR** after Elder pushes and Codex reviews

---

## 8. Communication Protocol

All parties report status on agent-comms thread `a792cbc8`:

| Event | Sender | Message Format |
|---|---|---|
| Elder starts | Elder | `ELDER START: restructure session begun` |
| Elder blocker | Elder | `ELDER BLOCKER: <specific issue>` |
| Elder done | Elder | `ELDER DONE: diff at <path>, validation <results>` |
| Codex review | Codex | `CODEX REVIEW: <accept/changes needed>` |
| Founder approval | Founder | `FOUNDER APPROVED: push authorized` |

**No silent assumptions.** If scope shifts, stop and surface on bus.

---

**Copy:** Elder (claude), Codex (codex), Founder (this message).