# starqERP — Support Policy, Severity Tiers & Escalation Matrix

## 1. Documented Support Channels

Clients may raise operational issues and support tickets through the following canonical routes:

* **Primary Support Inbox**: `support@starq.mv`
* **Emergency Outage Pager (Sev-1 Only)**: `urgent@starq.mv`
* **Direct Web Client Access**: Help & Support modal directly inside starqERP (`/settings` or header `?` icon)
* **Escalation Contact**: `founder@starq.mv` (Ali Musthaq, Founder & Managing Director)

---

## 2. Operating Hours & Honest Capacity

Starq Technologies operates on grounded, transparent capacity:

* **Standard Support Hours**: Sunday through Thursday, 09:00 – 18:00 MVT (UTC+5).
* **Friday & Weekend Schedule**: Friday (Jumu'ah) and Saturday are non-standard hours. Routine tickets are queued for the next business day.
* **Sev-1 Outage Protocol**: Critical Sev-1 incidents ("System is Down" or "Books / Ledger Corrupted") trigger 24/7 automated paging to the named escalation lead regardless of day or hour.

---

## 3. Severity Tiers & Response Targets

| Tier | Severity Definition | Example Scenarios | Initial Response SLA | Target Remediation |
|---|---|---|---|---|
| **Sev-1 (Critical)** | **System Down or Financial / Ledger Inaccuracy** | Cannot log in; database unreachable; invoices computing incorrect tax/totals; settlement data corrupted | $\le$ **4 hours** (24/7) | Continuous until mitigation |
| **Sev-2 (High)** | **Core Workflow Blocked (No Workaround)** | POS cannot process payments; job status stuck; inventory checkout fails | $\le$ **12 business hours** | $\le$ 24 business hours |
| **Sev-3 (Medium)** | **Workflow Degraded (Workaround Available)** | Slow report generation; search filter defect; non-blocking UI glitch | $\le$ **24 business hours** | Next sprint release |
| **Sev-4 (Low)** | **General Inquiry / Cosmetic / Feature Request** | Minor typography misalignment; export formatting request; general question | $\le$ **48 business hours** | Backlog / Scheduled |

---

## 4. Grounded Escalation Ladder

Every issue that is not resolved within the SLA target advances through a deterministic 3-tier escalation chain:

```
[Level 1: Support Triage] ────(> 4h unresolved on Sev-1)───► [Level 2: Lead Engineer]
      support@starq.mv                                              eng@starq.mv
                                                                         │
                                                             (> 8h unresolved on Sev-1)
                                                                         ▼
                                                            [Level 3: Final Escalation]
                                                            Ali Musthaq (Founder / MD)
                                                            founder@starq.mv / direct mobile
```

The escalation path terminates in a **named person** with full decision authority (Ali Musthaq), ensuring tickets never loop in an unowned queue.

---

## 5. End-to-End Test Walkthrough Verification

Before onboarding any client, a test ticket must be submitted and validated end-to-end:
1. Submission via client portal / email.
2. Ingestion into the tracked support backlog with unique Ticket ID.
3. Triage and confirmation of severity tier.
4. Resolution notification and client sign-off.

---
*Document Version: 1.0 — 26 August 2026*
