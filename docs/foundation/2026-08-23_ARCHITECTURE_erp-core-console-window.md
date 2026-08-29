# The ERP is the product. The console is a window onto it.

**Recorded 23 August 2026, from the founder, during the first real walkaround of the app.**

This corrects four assumptions Elder had been building on, and it should be read before any further
work on `starq-ops-app`.

---

## The principle, in the founder's own words

> *"just like we did hoadha… graph is the product, apps are windows on to them. same principle.
> erp is the core. console helps the manual ops work move faster, while capturing all required
> data for its ERP."*

Hoadha's product is the commercial graph; its apps are windows. Here, **STARQ ERP is the core** and
the operations console is a window. The console exists to do two things at once:

1. Make the manual work faster for the person doing it
2. **Capture the data the ERP needs, as a by-product of that work**

The second is the reason the first matters. People do not capture data they find painful, and an
ERP that people work *around* instead of *through* is an ERP with a spreadsheet running beside it.

### The test this gives us

> Does this element make the manual work faster, or does it capture something the ERP needs?
> If neither, it does not ship.

That is a sharper test than "is this good UX", and it settles most layout arguments without an
opinion.

---

## Four corrections to how Elder was building

### 1. Stop designing the app around the people who happen to exist

> *"what you're doing is designing the app around us people. which is wrong. app is the thing.
> people will need to work around it."*

Elder had been treating occupancy as governance. `DEC-064` asked who should take `quartermaster`.
`DEC-065` asked whether the segregation pairs should bend because two people cannot satisfy them.
**Both were the wrong question.**

The role model — seats, the command matrix, the segregation pairs — is part of the product and does
not move because this week's shop has one person in it. **Who occupies which role is data**, and it
changes weekly.

Every one of those "decisions" was a symptom of one missing feature: there is no user and role
management, so each assignment was a hand-edit to a JSON file in `_secrets` followed by a paste into
a Supabase dashboard. **Elder has been the admin panel.** That is why routine operations kept
arriving as questions requiring a founder ruling.

### 2. This is not a garage app

> *"not garage. any business. regardless of the activity… this can be moulded to any depending on
> the client SD takes, and the workflows designed by ST on ERP. this custom app is a console for
> their org's ops."*

The twelve steps are **Ignition Ink's workflow**, not the app's. Same for the role names and the
procurement controls. ST builds the engine; SD signs clients; workflows are configured per client.

What is hardcoded to one client today — evidence, not opinion:

| Hardcoded | Where |
|---|---|
| `const CLUB_IGNITION_ID = "30222026-…"` | `supabase/functions/starq-api/index.ts` — a **single tenant id in the Edge Function**, used by `establishPerson` and the readiness check |
| `garage_jobs`, `job_events` | table names |
| `api_garage_command`, `api_garage_pulse` | function names |
| `CALL → BOOKING → … → CLOSE` | a SQL `case` statement |
| `counter`, `technician`, `qc_signer` | role names in `contracts/commands.ts` |
| `SCM_STEP_SEATS`, `PURCHASE_STEP_SEATS` | one client's procurement controls |
| `isAli` | a person's name, in a UI conditional |

So today this is a **single-tenant garage app with multi-tenant plumbing underneath**.
`organisations` and `memberships` are properly modelled and tenant-scoped. The bones are right; the
flesh is one client.

### 3. Every client needs an admin panel — and admin is not a seat

> *"any garage business getting this app must have an admin panel. no questions."*

**Admin is a tenant capability, not one of the operational roles.** The operational seats are about
*doing the work*. Admin is about *managing who may do the work*. Different axis. A person can be
admin and hold operational seats, or admin and hold none.

`isAli` in the Flutter is the same class of wrongness as hardcoding the tenant id.

**The identity flow the founder specified:**

- A new person **signs in and becomes a pending person** — they are not pre-listed and not refused
- The admin receives an **email and an in-app notification**
- The admin **authorises them and assigns roles**
- When real staff take over a role, the founder **retires that role from himself** — his seat set
  shrinks as the team grows

This is the opposite shape to what exists. Today an **allowlist** says *you must be known before you
can arrive*. The specified system says *arrive, then be authorised*.

The database already supports the back half: `persons`, `memberships`, and `membership_seats` with
`revoked_at` — revocation is real and was the subject of audit critical #1. What is missing is the
front half.

### 4. There is a second consumer: the HQ module

> *"this garage console app must have its own STARQ ERP HQ module for MD to view all activities…
> MD must be able to see all ERP data."*

Two consumers, two shapes:

- **Ops console** — one person, one job, their seat, their next step. Task-shaped.
- **HQ module** — the whole business. Every job, the activity trail, the money, the exceptions.
  Oversight-shaped.

Same app, same tenant, different question being asked. Every client's MD gets this.

> #### Visibility is not authority
>
> The MD sees the entire purchase chain — who quoted, who awarded, who paid, when. That does **not**
> mean the MD may act in those seats. Oversight and execution are different rights, and separating
> them is what allows total visibility without dissolving the segregation controls underneath.
>
> Get this wrong and *"the MD can see everything"* quietly becomes *"the MD can do everything"*,
> which is where role models go to die.

**The HQ module is also Starq Dynamics' product surface.** SD sells managed operations on the
measure → SOP → automate loop; this module is the *measure*. When SD bills a client monthly, the
activity trail here is the evidence behind the invoice. It should therefore report in business terms
— jobs completed, time in each stage, where work stalls, exceptions raised — not list rows from
`job_events`.

---

## What this means for work already done

**`SERP-153` (per-step guidance and checklists) is load-bearing, not cosmetic.** The checklist is the
capture schema wearing a friendly face. *"Three photos of the panels"* is not a reminder; it is a
required field that does not look like one. Every tick is a fact in the ERP.

**`DEC-064` and `DEC-065` were mis-framed by Elder** and should be read as evidence of the missing
module rather than as governance. They asked the founder to rule on things that ought to be rows in
a table.

**The design system work stands.** It was specified against the workflow rather than against the
garage, and the tokens and component patterns generalise. The words on the steps are client
configuration.

---

## Order of work, cheapest-first

1. **Identity and roles as data.** Pending sign-in, admin as a tenant capability, notifications,
   the management panel, retiring the allowlist. Schema already supports it. No new engine.
2. **Remove the hardcoded tenant.** `CLUB_IGNITION_ID` resolved per request. Small, and nothing
   above it serves a second client until it is done.
3. **Roles become per-organisation definitions** rather than a fixed enum of twelve.
4. **Workflows become data** — steps, order, required role per step, controls per client. This is
   the real engine and the largest piece.
5. **HQ module** on top, reading what the console captured.

**1 and 2 are cheap now and expensive later** — retrofitting an identity model after it has real
users, or de-hardcoding a tenant after there are two, is the costly kind of change. 3, 4 and 5 are
genuine builds and should be planned, not improvised.

---

## Standing rules that come out of this

- The role model is product. Occupancy is data. Never confuse a missing row for a missing decision.
- Never hardcode a tenant, a person, or one client's vocabulary.
- Visibility is not authority.
- Every screen element must speed the manual work or capture ERP data. Preferably both.
- The console is a window. When the console and the ERP disagree about what happened, the ERP is
  what happened.
