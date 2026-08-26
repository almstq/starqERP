# Product Analytics Schema & Privacy Invariants (SERP-280)

- **Date:** 2026-08-26
- **Task:** SERP-280 (Product analytics that collect NOTHING sensitive — instrument the product, never the client's business)
- **Decisions:** DEC-073 §10, DEC-083
- **Author:** Codex / Antigravity

---

## 1. Principle & Core Invariant

> *"We may learn that a screen is used twice a day and abandoned 40% of the time. We may NOT learn what a client invoiced, to whom, or for how much. The first improves the product. The second is their commercial confidence."*

StarqERP telemetry strictly isolates operational product metrics from commercial customer data. The analytics pipeline default is **event names, counts, and timings only**.

---

## 2. Permitted Events Allowlist

| Event Name | Description | Permitted Property Keys | Example Payload |
|---|---|---|---|
| `screen_viewed` | User navigated to a top-level route | `route` | `{"route": "/jobs"}` |
| `modal_opened` | A dialog/drawer opened | `modalId` | `{"modalId": "create-job-modal"}` |
| `tab_switched` | Sub-tab switched in settings or details | `tabName` | `{"tabName": "roles_permissions"}` |
| `theme_toggled` | User toggled dark/light theme | `theme` | `{"theme": "dark"}` |
| `workflow_step_advanced` | Work order advanced between stages | `fromStageOrder`, `toStageOrder` | `{"fromStageOrder": 1, "toStageOrder": 2}` |
| `document_created_count` | Increment of created commercial doc | `documentType`, `count` | `{"documentType": "job", "count": 1}` |
| `search_executed` | Global search query executed | `resultCount`, `durationMs` | `{"resultCount": 3, "durationMs": 18}` |
| `error_occurred` | Client error boundary caught code | `errorCode`, `module` | `{"errorCode": "NETWORK_OFFLINE", "module": "invoices"}` |
| `mfa_challenge_prompted` | 2FA challenge modal presented | `method` | `{"method": "totp"}` |
| `mfa_challenge_completed` | 2FA challenge completed | `method`, `success` | `{"method": "totp", "success": true}` |

---

## 3. Disallowed Sensitive Fields & Fail-Closed Enforcement

The telemetry boundary actively inspects and rejects any payload containing:
* **Customer / Personal Identifiers:** `customer_name`, `name`, `customer`, `email`, `phone`, `plate_number`, `vehicle_reg`, `address`.
* **Financial & Accounting Data:** `amount`, `subtotal`, `total`, `price`, `unitPrice`, `tinNumber`, `bmlAccount`, `mibAccount`.
* **Free-Text & Query Contents:** `search_query`, `query`, `prompt`, `notes`, `details`, `description`, `rawError`, `stack`.
* **Security & Cryptographic Material:** `password`, `secret`, `token`, `csrf`, `recoveryCodes`.
* **Excessive String Lengths:** Any string property exceeding 64 characters or matching phone/email/currency patterns is blocked immediately.

---

## 4. Source-Side Tenant Anonymization

Tenant identifiers are salted and hashed at the source client prior to buffer ingestion:
$$\text{anonymizedTenantId} = \text{anon\_tenant\_} + \text{hash32}(\text{tenantId} + \text{salt})$$
No raw tenant UUIDs or customer database keys ever exit the client application boundary.
