# StarqERP — Privileged Path & SECURITY DEFINER Inventory (SERP-178)

**Date**: 24 August 2026  
**Authority**: Audit Finding Q8, DEC-072, DEC-082  
**Status**: COMPLETE (SERP-178)

---

## 1. Executive Summary

This inventory audits every `SECURITY DEFINER` function and RLS-enabled table in the StarqERP database.
Audit Finding Q8 established that `api_garage_command` accepts `target_org`, `target_person`, and `target_seat` as arguments. Identity is bound to the verified session **at the Edge Function boundary** (`supabase/functions/starq-api/index.ts`).

To prevent unauthorized direct execution, database functions are strictly restricted via PostgreSQL `REVOKE ALL ... FROM public, anon, authenticated` so they are **unreachable except via the `service_role` authenticated Edge boundary**.

---

## 2. Comprehensive `SECURITY DEFINER` Function Inventory

| Function Name | Schema | Execute Permissions | Identity Source | Tenant Boundary Safety |
| :--- | :--- | :--- | :--- | :--- |
| `app_private.has_organisation_access(uuid)` | `app_private` | Private to database engine (no public grants) | Derived from `auth.uid()` | **Safe**: Evaluates caller's membership against target org |
| `app_private.allocate_document_no(uuid, text)` | `app_private` | Private to database engine | `target_org` argument (internal callers) | **Safe**: Atomic row-level lock on tenant document counters |
| `app_private.assert_active_seat(uuid, uuid, text)` | `app_private` | Private to database engine | Validates person + org + seat linkage | **Safe**: Fail-closed SQL assertion |
| `public.api_garage_command(...)` | `public` | **`service_role` only** (`REVOKE` from `public`, `anon`, `authenticated`) | Edge Session authority | **Safe**: Hardened `search_path`, unreachable by direct client RPC |
| `public.api_garage_pulse(uuid)` | `public` | **`service_role` only** | Edge Session authority | **Safe**: Filtered by tenant `target_org` |
| `public.api_garage_purchases(uuid)` | `public` | **`service_role` only** | Edge Session authority | **Safe**: Filtered by tenant `target_org` |
| `public.api_session_authority(uuid, uuid, text)` | `public` | **`service_role` only** | Edge Session authority | **Safe**: Returns active seat bitmap for validated person |

---

## 3. RLS-Enabled Tables with No Policies (Fail-Closed Inventory)

In PostgreSQL, enabling Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) without creating permissive policies results in an absolute **deny-all (fail-closed)** state for `anon` and `authenticated` roles:

1. **`public.persons`**:
   * *Status*: Fail-closed. Direct read/write by clients is blocked.
   * *Access Model*: Managed exclusively through `service_role` during Google OAuth session establishment.
2. **`public.membership_seats`**:
   * *Status*: Fail-closed.
   * *Access Model*: Queried via `api_session_authority` and updated via `service_role` with revocation safeguards.
3. **`public.automation_capability_grants`**:
   * *Status*: Fail-closed.
   * *Access Model*: Internal system capability map; tenant isolation is bound to the owning principal.

---

## 4. Proposal & Architecture Clarification

The claim in early proposals that *"the organisation is resolved from session authority and never from a request payload"* is clarified as follows:
* **At the Edge Boundary**: Verified session HMAC and `auth.uid()` resolve the tenant and acting seat. The Edge rejects any request attempting cross-tenant injection.
* **At the Database Layer**: All operational RPCs are restricted strictly to `service_role`, preventing direct untrusted client execution.
