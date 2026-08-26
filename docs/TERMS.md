# starqERP — Terms of Service

*Effective Date: 26 August 2026*  
*Provider: Starq Technologies ("Starq", "we", "our")*

## 1. Provision of Software & Cloud Services

Starq provides cloud-based enterprise resource planning (ERP), point-of-sale (POS), supply chain, and financial record-keeping software ("the Service") designed for independent retail, garage, and trading operations.

---

## 2. Statutory Tax Status & Invoicing Disclosures (DEC-073 §10)

1. **Non-GST Registered Status**: Starq Technologies is currently **not registered for Goods and Services Tax (GST)** with the Maldives Inland Revenue Authority (MIRA).
2. **No GST Levied on Starq Fees**: Starq invoices for software subscriptions and onboarding services carry 0% GST and contain no GST Registration / Tax Identification Numbers for Starq.
3. **Tenant Tax Autonomy**: The software enables tenants to configure their own independent MIRA tax status (e.g. 8% GGST / 16% TGST). Each tenant is solely responsible for the accuracy of their own tax filings and declarations.

---

## 3. Data Hosting, Infrastructure & Security Architecture

1. **Data Hosting Location**: Customer production data and backups are hosted in secure Tier-3 data centers located in the Asia-Southeast region (Singapore) via managed Supabase/AWS cloud infrastructure.
2. **Multi-Tenancy & Isolation Architecture**:
   * Data isolation between client tenants is enforced through application-level tenancy gates, mandatory composite foreign keys (`[tenant_id, id]`), and session-bound JWT security claims.
   * *Explicit Qualification*: Comprehensive automated adversarial penetration testing of Row-Level Security (RLS) is tracked and documented under engineering milestone `SERP-172` / `SERP-124`.

---

## 4. Support SLAs & Service Commitments

Support availability, severity classifications (Sev-1 to Sev-4), operating hours, and named escalation paths are governed strictly by the published [Support Policy](SUPPORT.md).

---

## 5. Termination & Concrete Data Exit Guarantee

We believe that clients stay with Starq because of software quality, never because their data is held hostage:

1. **Client Ownership**: The client retains 100% legal ownership of all business, transactional, customer, and financial records inputted into the Service.
2. **Export on Exit**: Upon written termination or exit request, Starq guarantees full extraction and delivery of all client master data, transactions, audit logs, and ledger records in open, machine-readable formats (**JSON and CSV**) within **14 business days**.
3. **Post-Termination Retention**: Upon delivery of the exit archive, production tenant data is kept in a deactivated read-only state for a 30-day grace period, after which all tenant records are permanently expunged from live databases.

---

## 6. Limitation of Liability

The Service is provided on an "as is" and "as available" basis. To the maximum extent permitted by Maldivian law, Starq’s aggregate liability for any direct operational disruption or defect shall not exceed the subscription fees paid by the client in the three (3) months preceding the claim.

---
*Governing Law: Republic of Maldives*
