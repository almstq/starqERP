# Proof procedure — audit critical #1: a revoked seat stays revoked

**Status: NOT YET RUN.** Until it is, critical #1 is *fixed in code and deployed*, not *closed*.

## Why this document exists

`DEC-055` was recorded on 22 August with the note *"Audit critical #1 is now in effect rather
than written."* That was wrong. The migration created a database function; the code that calls
it lives in the Edge Function, and the deployed Edge was four days older than the fix. Revoked
seats were still being reinstated at every login while the record said otherwise.

The correction is in `DEC-055` and `DEC-063`. The lesson is this: **a fix that is deployed is
not the same as a control that is proven, and only one of them may be written down as closed.**

So critical #1 gets an actual test, and this is it. Five minutes, one SQL statement, two
sign-ins.

## What the defect was

`establishPerson` in the Edge Function used to write `revoked_at: null` on every sign-in. That
silently un-revoked every seat an administrator had withdrawn. **Access could not be taken away
from anybody** — a revocation lasted exactly until that person next logged in.

The fix is an omission, not a different value. The payload no longer mentions the column at all,
and the write is insert-if-absent (`ignoreDuplicates`), so an existing seat row is left entirely
alone. Only an explicit, audited grant can restore it.

## The procedure

### 1. Confirm the starting state

Sign in, tap the seat badge. Note the seats listed. `payer` should be among them.

Or in the SQL editor:

```sql
select p.person_key, ms.seat_code, ms.revoked_at
from public.persons p
join public.memberships m on m.person_id = p.id
join public.membership_seats ms on ms.membership_id = m.id
where p.person_key = 'ali'
order by ms.seat_code;
```

Every `revoked_at` should be `NULL`.

### 2. Revoke one seat

`payer` is the right one to test with — it is not needed to sign in, and not needed for any
counter action, so nothing else is disturbed.

```sql
update public.membership_seats ms
   set revoked_at = now()
  from public.memberships m
  join public.persons p on p.id = m.person_id
 where ms.membership_id = m.id
   and p.person_key = 'ali'
   and ms.seat_code = 'payer';
```

Confirm it took:

```sql
select ms.seat_code, ms.revoked_at
from public.membership_seats ms
join public.memberships m on m.id = ms.membership_id
join public.persons p on p.id = m.person_id
where p.person_key = 'ali' and ms.seat_code = 'payer';
```

`revoked_at` must now hold a timestamp.

### 3. Sign out, and sign back in

Both halves matter. **Signing out is what makes this a real test** — the old defect only fired
on the login path, so a page refresh would prove nothing.

### 4. The result

Tap the seat badge.

| Outcome | Meaning |
|---|---|
| **`payer` is GONE** | ✅ **PASS.** Critical #1 is closed. The revocation survived a login, which is exactly what it could not do before. |
| **`payer` is still listed** | ❌ **FAIL.** Sign-in is still reinstating revoked seats. Stop and report it — the deployed Edge is not the build we think it is. |

Also check `api_session_authority` agrees, since that is what every request consults:

```sql
select public.api_session_authority(m.organisation_id, p.id, 'director') as authority
from public.persons p
join public.memberships m on m.person_id = p.id
where p.person_key = 'ali';
```

The `seats` array must no longer contain `payer`.

### 5. Put it back

**Do not skip this.** Leaving `payer` revoked will make the purchase chain fail later in a way
that looks like a different bug.

```sql
update public.membership_seats ms
   set revoked_at = null
  from public.memberships m
  join public.persons p on p.id = m.person_id
 where ms.membership_id = m.id
   and p.person_key = 'ali'
   and ms.seat_code = 'payer';
```

Sign out and in once more, and confirm `payer` is back in the badge. That also proves the
*grant* path still works — a control that cannot be undone is its own kind of defect.

## Recording the result

On a pass, `DEC-063`'s note and the audit register move critical #1 from *deployed* to *closed*,
**citing this procedure and the date it was run.** Not before.

On a fail, it is a live production defect and everything else stops.

## A note on why `payer` and not another seat

`director` is the default acting seat, so revoking it would knock the session out on the next
request and confuse the result. `counter` is needed for every garage action. `payer` is held,
visible in the badge, and idle — it changes nothing else while the test runs.
