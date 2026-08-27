# Multi-Tenancy & Organizational Spine

starqERP features a 5-tier organizational hierarchy designed to reflect the real-world operational structure of commercial enterprises in island economies.

---

## The 5-Tier Organizational Model

$$\text{Identity} \longrightarrow \begin{matrix} \text{Platform Entitlement} \\ \text{and/or} \\ \text{Tenant Memberships} \end{matrix} \longrightarrow \text{Legal Entity} \longrightarrow \text{Business Name} \longrightarrow \text{Operating Book} \longrightarrow \text{Location / Facility}$$

### 1. Identity & Operator Principals
- User identities are verified through Google Workspace OAuth 2.0.
- Operators holding platform-level entitlements (`platform.operator_principals`) gain access to Starq HQ SaaS management capabilities.

### 2. Legal Entities (`public.organisations`)
- Represents the registered corporate company holding legal liability, tax identification (TIN), registered office, and statutory accounts.
- Governed by RLS policies: Every query on `organisations` and downstream tables filters on `organisation_id = auth.current_org()`.

### 3. Business & Trading Names (`public.business_names`)
- Represents the registered trading or brand names under the legal entity (e.g. *Starq Technologies Software & Consulting*, *Club Ignition Auto Care*).

### 4. Operating Books (`public.books`)
- Operating books isolate discrete business activities and ledger domains within the same company.
- Each book has a dedicated archetype (`general_business`, `automotive_workshop`, `retail_commerce`), code, and independent sequence numbering.
- An organization has exactly one default active book, enforced via PostgreSQL partial unique index `books_single_default_uq`.

### 5. Locations & Shared Facilities (`public.locations`, `public.book_locations`)
- Physical locations (workshops, showrooms, warehouses, branch counters) can be linked to one or more books, enabling shared warehousing and physical resource optimization.
