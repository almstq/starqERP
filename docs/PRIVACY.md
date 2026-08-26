# starqERP — Privacy Notice & Data Protection Policy

*Effective Date: 26 August 2026*  
*Provider: Starq Technologies ("Starq")*

## 1. Scope and Purpose

This Privacy Notice outlines how Starq Technologies collects, processes, hosts, and protects commercial and personal data processed through the starqERP cloud platform.

---

## 2. Data Categories Processed

Starq processes the following categories of data on behalf of client tenants:
* **Account & Authorization Data**: User email addresses, full names, assigned role codes, and cryptographic session tokens.
* **Commercial Records**: Point-of-sale transactions, customer names and contact numbers, vehicle registration identifiers, inventory SKUs, purchase orders, invoices, and expense records.
* **Forensic Audit Trails**: Security events, authentication logs, and IP addresses recorded at the edge gateway.

---

## 3. Data Hosting Location & Sub-Processors

* **Primary Hosting Location**: Production databases and file storage are hosted in the **Asia-Southeast Region (Singapore)** on Supabase / AWS infrastructure.
* **Sub-processors**:
  1. **Supabase Inc.** — Managed PostgreSQL database, authentication, and edge function compute (Hosted in Singapore).
  2. **Amazon Web Services (AWS)** — Cloud storage and backup hosting.
  3. **Google Identity Services** — OAuth 2.0 federated authentication (when enabled by the tenant).

No customer financial or transactional data is sold, monetized, or transferred to unvetted third parties.

---

## 4. Retention Schedules & Deletion

| Record Category | Retention Duration | Disposal Method |
|---|---|---|
| Active Tenant Commercial Data | Duration of active subscription | Cryptographic isolation / Live DB |
| Post-Termination Data | 30 days post-termination grace period | Secure digital wiping / Deletion |
| Security & Audit Logs | 365 days rolling window | Append-only partition purging |
| Data Export Archives | Delivered within 14 business days; retained in encrypted staging for 14 days | Deleted after client verification |

---

## 5. Security & Isolation Transparency

Starq enforces multi-tenant isolation through application-level tenancy verification and composite database foreign keys. Formal Row-Level Security isolation test evidence is maintained in the project vault (`SERP-172`/`SERP-124`).

For vulnerability disclosures or privacy concerns, contact: `security@starq.mv`.
