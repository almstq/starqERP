# SERP-020 — backup and verified restore, before the migration push

**Authority:** `DEC-055` option A — *backup first, then push.* Not a risk acceptance.
**Blocks:** `SERP-119`. **Also discharges part of:** `DEC-019`.
**Operator: the founder.** Elder has no Supabase credentials and must not be given any.

> **A backup is not proven by producing a file. The restore has to be exercised.**
> An untested backup is a belief, not a control — and this project's standing lesson is that a
> test which has never failed has not been shown to detect anything.

---

## Before you start

- Everything below is **read-only against production**. Nothing here applies a migration.
- **RULE 0:** the dump goes to **D:** or to **E:**. Never C:.
- The Supabase CLI is installed (2.105.0) but **not authenticated** on this machine.

## Step 1 — authenticate and confirm you are pointed at the right project

```bash
supabase login
```

```bash
cd D:/!starq/starqERP/legacy/engine && supabase projects list
```

The linked ref must be **`wthabguvueewgtabjsdo`** ("Starq Books"). If it is not, stop.

## Step 2 — confirm the pending set is still exactly {0008, 0009, 0010}

This is pre-condition **P3**, and it doubles as the live half of `SERP-117` — the half the finding
deliberately deferred to here rather than claiming.

```bash
cd D:/!starq/starqERP/legacy/engine && supabase migration list --linked
```

Remote must show `0001`–`0007` applied and exactly those three pending. **Anything else appearing
means someone changed production outside this process — stop and say so.**

## Step 3 — take the dumps

Three files, because they restore differently and a roles/data-only pair is what makes a clean
scratch restore possible.

```bash
cd D:/!starq/starqERP/legacy/engine && supabase db dump --linked -f D:/StarqTech/_backups/db-20260822-schema.sql
```

```bash
cd D:/!starq/starqERP/legacy/engine && supabase db dump --linked --data-only -f D:/StarqTech/_backups/db-20260822-data.sql
```

```bash
cd D:/!starq/starqERP/legacy/engine && supabase db dump --linked --role-only -f D:/StarqTech/_backups/db-20260822-roles.sql
```

## Step 4 — record what you got

```bash
cd D:/StarqTech/_backups && sha256sum db-20260822-*.sql | tee db-20260822-MANIFEST.txt && ls -lh db-20260822-*.sql
```

## Step 5 — RESTORE IT. This is the step that makes it a backup

Restore into a **scratch** target — a local Supabase instance or a throwaway project. **Never into
the live project.**

```bash
cd D:/!starq/starqERP/legacy/engine && supabase start
```

```bash
cd D:/!starq/starqERP/legacy/engine && psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -f D:/StarqTech/_backups/db-20260822-schema.sql
```

Then prove it actually holds the business, not just that the file parsed:

```bash
cd D:/!starq/starqERP/legacy/engine && psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c "select (select count(*) from public.seats) as seats, (select count(*) from public.memberships) as memberships, (select count(*) from information_schema.tables where table_schema='public') as tables;"
```

**Expected: 8 seats** (the four new ones arrive only with `0009`, which is the whole point of the
repair), memberships non-zero, and roughly 25 tables. If seats returns 12, you have restored
something that already has the migration and the backup is not of the state you think.

```bash
cd D:/!starq/starqERP/legacy/engine && supabase stop
```

## Step 6 — get it off the machine

`DEC-019`: encrypted external drive, kept off-site.

```bash
mkdir -p "E:/STARQ-TIER1/db-20260822" && cp D:/StarqTech/_backups/db-20260822-*.sql D:/StarqTech/_backups/db-20260822-MANIFEST.txt "E:/STARQ-TIER1/db-20260822/"
```

```bash
printf '%s  db-20260822  supabase dump: schema+data+roles, restore-verified  \n' "$(date '+%Y-%m-%d %H:%M')" >> "E:/STARQ-TIER1/BACKUP-LOG.txt"
```

---

## Then tell Elder

Elder records P4 satisfied in the change plan with the date, the checksums and the restore result,
and `SERP-119` becomes unblocked — **subject to DP's review still landing.** The backup does not
substitute for P2.

**Say plainly if step 5 was skipped.** A dump with no restore is worth recording honestly as a dump
with no restore, and `DEC-055` chose this route precisely to avoid an unproven position. Elder will
record what happened, not what was intended.
