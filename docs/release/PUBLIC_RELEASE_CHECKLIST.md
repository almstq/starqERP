# starqERP — Public Release Sign-Off Checklist
**Release Candidate Target**: v0.2.0-beta  
**Status**: PENDING FOUNDER APPROVAL (DO NOT MAKE PUBLIC YET)  

---

## 1. Documentation & Representation Gates

- [ ] **Root README Cleanliness**:
  - [ ] Root `README.md` replaced with sanitized `docs/release/README_PUBLIC_DRAFT.md`.
  - [ ] All obsolete progress claims ("117/264", "37/40 pilot", "3 remaining tasks") purged.
  - [ ] Volatile metrics unified into single clearly labeled canonical snapshot (318 canonical tasks, 117 Done, 36.79%).
  - [ ] Two-plane architecture and 5-tier organizational model clearly diagrammed.
- [ ] **Public Documentation Layer**:
  - [ ] `docs/architecture/` populated with public architectural guides.
  - [ ] `docs/development/` populated with local setup and testing guides.
  - [ ] `docs/security/` populated with RLS and tenant isolation specs.
  - [ ] `docs/roadmap/public-roadmap.md` matches `PUBLIC_ROADMAP.md`.
- [ ] **Private Document Isolation**:
  - [ ] All internal agent handoffs, Elder return briefs, and competitor gap audits moved to private internal storage (`PRIVATE_EXCLUSION_MANIFEST.md`).

---

## 2. Secrets, PII & Sanitization Gates

- [ ] **Secret Scanning**:
  - [ ] Zero live API keys, JWT tokens, service role keys, or database credentials present in HEAD.
  - [ ] All `.env` files ignored via `.gitignore` and only `.env.example` placeholder committed.
  - [ ] `audit_repo_secrets.mjs` runs with zero high-severity findings.
- [ ] **Contact & Developer Data Sanitization**:
  - [ ] All developer personal emails (`founder@example.com`, `engineering@example.com`, etc.) replaced with generic project addresses (`dev@starq.mv`, `security@starq.mv`).
  - [ ] All client contacts in contracts replaced with standard synthetic fixtures (`demo@example.com`).
- [ ] **Demo Data Fictionalization**:
  - [ ] All public seed fixtures use explicitly synthetic names (*Demo Workshop Ltd*, *Demo Trading Pvt Ltd*).
  - [ ] All sample TINs, vehicle registrations, and bank numbers use invalid test formats.

---

## 3. Git History & Repository Strategy Gate

- [ ] **Publication Method Sign-Off**:
  - [ ] **Method A (Clean-Room Repo — Recommended)**: Create a new sanitized public repository from clean HEAD snapshot with single initial release commit.
  - [ ] **Method B (History Rewrite)**: If retaining existing repo, run `git filter-repo`, purge reflogs, and verify history clean before changing visibility.
- [ ] **Visibility Gate**:
  - [ ] Repository visibility on GitHub remains **PRIVATE** until Founder explicitly executes publication.

---

## 4. Governance & Legal Gates

- [ ] **License Defined**:
  - [ ] Add explicit `LICENSE` file (e.g. Business Source License / Source-Available Commercial License).
- [ ] **Security Disclosure**:
  - [ ] `SECURITY.md` and `.well-known/security.txt` active with vulnerability reporting protocol.
- [ ] **Contribution Guidelines**:
  - [ ] `CONTRIBUTING.md` and standard PR/Issue templates configured.

---

## 5. Automated CI & Build Verification

- [ ] **Frontend Suite**: 39 test files, 157+ Vitest tests passing green.
- [ ] **Database Verification**: Migration probe suites (`migrations_0024_0025_verification.test.mjs`) passing green.
- [ ] **Responsive Viewport Suite**: `ui_responsive_system.test.mjs` passing green.
- [ ] **TypeScript & Linting**: `tsc --noEmit` clean with zero errors.
