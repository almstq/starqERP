# Contributing to starqERP

Thank you for your interest in contributing to starqERP. We welcome bug reports, architectural feedback, and pull requests.

---

## 1. Development Workflow

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Ensure all dependencies are installed:
   ```bash
   npm --prefix web install
   ```
3. Run the automated test suites locally before submitting:
   ```bash
   npm --prefix web test
   npm --prefix web run lint
   node --test tests/migrations_0024_0025_verification.test.mjs
   ```
4. Commit using conventional commit messages (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).
5. Open a Pull Request against `main`. All CI checks must pass before review.

---

## 2. Security Disclosures

If you discover a security vulnerability, please **do NOT open a public GitHub issue**. Instead, follow the responsible disclosure process outlined in [`SECURITY.md`](./SECURITY.md) or email `security@starq.mv`.
