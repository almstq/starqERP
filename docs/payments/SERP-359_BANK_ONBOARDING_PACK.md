# Merchant Onboarding Requirements Pack — BML and MIB

**Prepared:** 29 August 2026
**Task:** SERP-359
**Applicant:** Starq Technologies Pvt Ltd
**Product:** starqERP (multi-tenant SME ERP, subscription billing)

> **Evidence discipline.** No bank specification has been invented in this document. Where a
> statement about BML or MIB appears, it is either quoted from a cited public source or it is
> written as a question to the bank and marked `BANK_SPEC_REQUIRED`. Anything not verifiable from a
> public source is stated as "not verified from public sources". Every fact about Starq is drawn
> from the company's own records.

---

## 0. What Starq is asking for, and what it is not

State this early in any conversation with a bank. It pre-empts the acquiring bank's first
concern, which is whether the applicant is handling other people's money.

| | Position |
|---|---|
| **What Starq wants** | A standard online card-acceptance (internet payment gateway) merchant facility so that Starq can collect its own subscription fees from its own customers. |
| **Who the payer is** | The subscribing SME, paying Starq for a starqERP licence. |
| **Who the payee is** | Starq Technologies Pvt Ltd, into a settlement account in its own name. |
| **Card data handling** | **Hosted checkout only.** The cardholder is redirected to the bank's hosted payment page. Card data never touches Starq infrastructure, is never stored, processed or transmitted by Starq systems. This is intended to keep Starq's PCI DSS posture at **SAQ-A**, the lowest merchant assessment tier. |
| **Starq is NOT** | Not a payment service provider. Not building or operating a wallet. Not holding, pooling or escrowing customer funds. Not settling to third parties. Not a marketplace or aggregator. Not collecting money on behalf of its customers. |

**Architecture note for the bank (and for internal engineering).** Starq's payment layer is
provider-neutral. BML and MIB are implemented as **adapters behind one common internal
interface**. The bank is not the architecture; the bank is a pluggable acquirer. This means Starq
can onboard with either or both banks, and the commercial conversation with one does not lock the
engineering to it.

---

## 1. Applicant identity — verified Starq facts

These are the facts to put on any application form. They are internally verified and should not be
restated differently anywhere in the application.

| Field | Value |
|---|---|
| Legal name | Starq Technologies Pvt Ltd |
| Company registration no. | C29552026 |
| Unique Entity Identifier (UEI) | 2026PV02930B |
| Date of registration | 4 August 2026 |
| Registered office | G. Fullaage, K. Malé, Republic of Maldives |
| Sole shareholder | Ali Mushthaq Ibrahim |
| Sole Director / Managing Director | Ali Mushthaq Ibrahim (National ID A096835) |
| Common seal | S09932026 |
| Registered activity 1 | ISIC 6201 — computer programming, trading as **Starq Technologies** |
| Registered activity 2 | ISIC 8211 — combined office administrative services, trading as **Starq Dynamics** |
| GST registration | **Not registered.** Do not describe the company as GST-registered on any form or invoice. |
| Other tax registrations | CIT, EWT, NWT — active |
| Banking | MIB account in progress (board resolution STARQ/BR/2026/003 covers MIB banking services and FaisaNet). BML is used at group level. **The bank mandate is not yet settled.** |

**The merchant application should be filed under the ISIC 6201 / "Starq Technologies" activity**,
since starqERP is a software product. Confirm with the bank whether the activity name on the
merchant record must match the registered business activity name exactly.

---

## PART A — What Starq must supply to the bank

### A.1 What the banks publicly say they require

Two items below are from primary sources. Everything else in Part A is a prudent superset that any
acquiring bank would be expected to want; items not in the cited sources are marked as such.

**BML — from the published Merchant Application Form (version 1.4)**
Source: https://www.bankofmaldives.com.mv/storage/file/54/10867/merchant-application-form-en.pdf

The form's "DOCUMENTS REQUIRED" block lists:

- Board Resolution (if you have not previously submitted)
- Profile sheet generated through the business portal of the Ministry of Economic Development
- Business Activity Registration (required if activity details are not available on Profile Sheet) — where applicable
- Operating Licence / Maldives Food and Drug Authority permit — where applicable

And, separately: "Following document will be required for Payment Gateway API Integration:
**Domain Registration**".

Other verbatim points from that form that bear directly on Starq:

- The form's service-selection block includes "Payment Gateway Service — Please fill only sections 1, 2, 3 and 4", and an "API Integration required? Yes / No" checkbox with the note "Applicable only to merchants with a website."
- Section 4, Settlement Account Details: "Account should be a Business Account opened with BML in the name of the entity." Currency options MVR / USD, with the note that "Dual settlement option is limited to tourism-related businesses and businesses remitting taxes in USD."
- Section 3 covers Authorised Users of the Merchant Portal (administrative access), noting such users "will receive full access to BML Merchant Portal and BML mPOS for the entity without requiring additional approvals" and can create further users.
- Declaration clause 5: "I/We agree not to charge Cardholders any fee for using the Card as defined in the Terms." — **This is a product-design constraint. Starq must not add a card surcharge to a starqERP subscription invoice.**
- Note on the form: "Ensure the business is ready for operation before submitting the application. Incomplete applications or premises not ready for inspection will result in cancellation of the application 10 days after the submission date."

**MIB — MIB Global Pay**
MIB's own pages returned HTTP 403 to automated retrieval, so the following is from MIB's public
knowledge-base article, which was retrievable:
Source: https://help.mib.com.mv/portal/en/kb/articles/mib-global-pay

- How to apply: "Submit a fully filled application form and the BR as per the given format to any Branch and Distribution Centre."
  *(The expansion of "BR" is ambiguous between Board Resolution and business registration across MIB's public wording. **Confirm with MIB** — see Part B.)*
- Accepts "All Visa and MasterCards".
- Uses "Verified by Visa" and "MasterCard Secure Code" two-factor authentication.
- Described as "fully 'Payment Card Industry Data Security Standard (PCI DSS)' compliant".
- Fees: the article directs readers to "the Bank's List of Charges available for download" and states no figures. **MIB's fee schedule for Global Pay is not verified from public sources.**
- Settlement terms, API details and integration details: **not addressed in that article; not verified from public sources.**

Reported elsewhere (secondary, treat as unconfirmed background, not as specification): press
coverage states MIB Global Pay is built on Mastercard Payment Gateway Services and offers
tokenisation, recurring payments and a merchant portal — e.g. https://psmnews.mv/en/91382. Do not
build against this. Confirm directly with MIB.

### A.2 The Starq-side checklist

Status key: **HAVE** — Starq holds it today. **PARTIAL** — exists but needs producing, updating or
confirming. **MISSING** — must be created or obtained. **BLOCKED** — depends on something unsettled.

| # | Item | Status | Note |
|---|---|---|---|
| 1 | Certificate of incorporation / company registration, no. C29552026 | HAVE | Registered 4 Aug 2026 |
| 2 | UEI 2026PV02930B on record | HAVE | |
| 3 | Ministry of Economic Development business portal **profile sheet** (freshly generated) | PARTIAL | BML names this explicitly. Must be regenerated close to submission so it is current |
| 4 | Business activity registration — ISIC 6201, "Starq Technologies" | HAVE | Supply if activity is not visible on the profile sheet |
| 5 | Business activity registration — ISIC 8211, "Starq Dynamics" | HAVE | Disclose for completeness; the merchant record should sit under 6201 |
| 6 | Operating licence / sector permit | N/A | Software development is not, so far as known, a licensed activity here. Confirm with the bank that "not applicable" is accepted |
| 7 | Tax registration status — CIT / EWT / NWT active; **GST not registered** | HAVE | Disclose accurately. Do not claim GST registration |
| 8 | Company profile / business description document | MISSING | One or two pages: what starqERP is, who buys it, how it is priced and delivered. Write once, reuse for both banks |
| 9 | Director and beneficial owner identification — Ali Mushthaq Ibrahim, National ID A096835 | HAVE | Sole shareholder and sole director; UBO disclosure is trivially simple, which helps |
| 10 | Sole-shareholder / ownership-structure declaration | PARTIAL | Likely a standard KYC form supplied by the bank; ownership itself is 100% Ali Mushthaq Ibrahim |
| 11 | **Board resolution** authorising the merchant/payment-gateway application, naming authorised signatories and merchant-portal administrators | MISSING | Required by both banks. STARQ/BR/2026/003 covers MIB banking and FaisaNet — it does **not** cover card acquiring. A **new** resolution is needed, and each bank may require its own format ("as per the given format" — MIB) |
| 12 | Company seal available for execution — S09932026 | HAVE | BML's form has a "Company Seal" block |
| 13 | **Settlement account in the company's own name** | **BLOCKED** | See §C.1. BML's form requires a BML business account in the entity's name for BML settlement. The MIB account is in progress. This is the critical path |
| 14 | Settlement currency decision (MVR base) | HAVE (decision) | Pricing is MVR 1,500/month per legal entity. BML's dual MVR/USD settlement is restricted to tourism businesses and USD taxpayers, so **MVR-only** is the expected posture |
| 15 | Authorised merchant-portal administrators — names, ID numbers, contact numbers, email addresses | PARTIAL | BML Section 3. Note these users get full portal access and can create more users; choose deliberately |
| 16 | Point of contact for the application — full name as on ID, ID number, designation, contact number, email | HAVE | BML Section 2 |
| 17 | **Domain registration evidence** for the product domain | PARTIAL | Explicitly required by BML for Payment Gateway API integration. Confirm the exact production domain before applying; a later change may require a change request |
| 18 | Live, publicly reachable product website / checkout URL | PARTIAL | starqERP is pre-commercial. The site must be reachable and coherent before the bank reviews it |
| 19 | Clear description on the site of **what is being sold** | MISSING | A software subscription. Plan tiers and MVR 1,500/month per legal entity should be visible |
| 20 | **Pricing page** | MISSING | Prices, currency (MVR), billing period |
| 21 | **Refund / cancellation policy page** | MISSING | Standard acquirer requirement for e-commerce. Must state refund conditions and timelines |
| 22 | **Terms of service page** | MISSING | |
| 23 | **Privacy policy page** | MISSING | |
| 24 | **Contact / company identity on the site** — legal name, registration number, Malé address, contact email and phone | MISSING | Acquirers routinely check that the merchant is identifiable on its own site |
| 25 | Delivery / fulfilment description (how the service is provisioned after payment) | MISSING | For SaaS: immediate account activation. Say so |
| 26 | Statement of accepted card schemes shown at checkout | MISSING | Depends on which schemes the chosen bank enables — do not print scheme logos until confirmed |
| 27 | Expected monthly transaction volume and average ticket size | PARTIAL | Must be a forecast, honestly labelled as such. Basis: MVR 1,500/month per entity, no live paying customers yet. Prepare a defensible 12-month ramp rather than an optimistic number |
| 28 | Expected maximum single transaction value | PARTIAL | Annual prepay of a multi-entity account is the realistic ceiling — compute it before applying |
| 29 | Refund/chargeback expectation statement | PARTIAL | Subscription software has low chargeback exposure; say so, and say why (named business customers, contracted, recurring) |
| 30 | **PCI DSS posture: SAQ-A**, on the basis of hosted checkout with full redirect and no card data on Starq systems | PARTIAL | Write this as a short, signed statement. It is the single most useful paragraph in the pack — it materially reduces what the bank will require |
| 31 | Basic information security statement — TLS on the product domain, access control, no card storage | MISSING | One page; complements the SAQ-A statement |
| 32 | AML/CFT and sanctions questionnaire responses | PARTIAL | Bank-supplied forms; the simple ownership structure makes this straightforward |
| 33 | Signed acceptance of the bank's card-acceptance terms | PENDING | BML: "Terms and Conditions for Card Acceptance". MIB: MIB Global Pay Terms & Conditions. **Read both in full before signing** — the MIB T&C document was not retrievable by automated means and must be obtained from the branch |
| 34 | Confirmation that **no card surcharge** will be applied to customers | HAVE (decision) | BML's declaration clause 5 prohibits charging cardholders a fee for card use. Bake this into billing logic |
| 35 | Recurring-billing intent disclosed to the bank | PARTIAL | starqERP is a monthly subscription. Whether this is done as scheduled recurring payments, tokenised card-on-file, or customer-initiated payment each cycle is a **bank-dependent** decision — see Part B |

**Count: 35 checklist items.**

Summary of Part A: 9 HAVE, 1 N/A, 14 PARTIAL, 10 MISSING, 1 BLOCKED, and the terms acceptance
pending. The MISSING items are almost entirely **website content pages** — cheap to produce, and
they gate the bank's review, so they should be written now rather than at application time.

---

## PART B — What Starq must ask the bank (`BANK_SPEC_REQUIRED` register)

Every question below is unanswered. None of these has been assumed, and no answer to any of them
should be inferred from another bank, another country, or another gateway product. Ask each
question of **each** bank separately; the answers will differ and both are adapters.

**Onboarding and commercial**

1. `BANK_SPEC_REQUIRED` What is the full merchant application pack for an **internet payment gateway / e-commerce** facility, as distinct from POS, and which forms and annexes must be submitted?
2. `BANK_SPEC_REQUIRED` Is a settlement account with **your** bank mandatory, or may settlement be made to an account at another Maldivian bank?
3. `BANK_SPEC_REQUIRED` What is the required **board resolution format**? MIB's guidance says "as per the given format" — please supply the template. Does BML require a specific wording?
4. `BANK_SPEC_REQUIRED` Is the applicant's business activity (ISIC 6201, computer programming / SaaS subscription) an accepted merchant category, and what **MCC** will be assigned?
5. `BANK_SPEC_REQUIRED` What is the expected **end-to-end onboarding timeline** from complete submission to production merchant ID, in working days?
6. `BANK_SPEC_REQUIRED` Is a physical **premises inspection** required for a software business with no retail premises? (BML's form warns of cancellation where "premises [are] not ready for inspection".)
7. `BANK_SPEC_REQUIRED` Is there a **minimum trading history, minimum turnover, or minimum volume** requirement? Starq is a newly registered company (4 Aug 2026) with no live paying customers.
8. `BANK_SPEC_REQUIRED` Is a **security deposit, rolling reserve, or holdback** required for a new merchant, and if so on what terms and for how long?
9. `BANK_SPEC_REQUIRED` What is the process to move from a sandbox/test merchant to a **production merchant ID**, and are they issued separately?

**Fees**

10. `BANK_SPEC_REQUIRED` What is the complete **fee structure** — setup/joining fee, monthly or annual gateway fee, per-transaction MDR (by card scheme, and by domestic vs international card), minimum monthly fee, refund fee, chargeback fee, settlement fee?
11. `BANK_SPEC_REQUIRED` **How are fees deducted** — netted off each settlement, netted off the daily batch, or invoiced separately in arrears?
12. `BANK_SPEC_REQUIRED` Are fees inclusive or exclusive of any applicable tax, and how are they evidenced for the merchant's own bookkeeping?
13. `BANK_SPEC_REQUIRED` Is there a published **List of Charges** covering the gateway product, and which version applies to a new merchant?

**API and integration**

14. `BANK_SPEC_REQUIRED` What are the **API base URLs** for (a) sandbox/test and (b) production?
15. `BANK_SPEC_REQUIRED` Is there **integration documentation** (developer guide, API reference, integration handbook), and how is it obtained — is an NDA required before release?
16. `BANK_SPEC_REQUIRED` What is the **authentication scheme** for API calls — API key, HMAC-signed request, mTLS client certificate, OAuth 2.0 client credentials, or other? How are credentials issued, rotated, and revoked?
17. `BANK_SPEC_REQUIRED` Are there **IP allowlisting** requirements for API calls or for receiving callbacks, and if so what static egress/ingress addresses must Starq supply?
18. `BANK_SPEC_REQUIRED` What exactly does the **hosted-checkout redirect flow** look like — how is a payment session created, what parameters are required, what is the redirect mechanism (HTTP 302, form POST, JS SDK), and how does the customer return to the merchant?
19. `BANK_SPEC_REQUIRED` Can the hosted checkout page be **branded** (merchant logo, colours), and what is the approval process for that?
20. `BANK_SPEC_REQUIRED` What is the **session/payment expiry** on a hosted checkout, and what happens if the customer abandons the page or closes the browser before returning?
21. `BANK_SPEC_REQUIRED` Is there an authoritative **query/verify API** to fetch a transaction's final status by merchant reference, independent of the redirect and the webhook? (Starq intends to treat this as the source of truth, but must not assume it exists.)
22. `BANK_SPEC_REQUIRED` What **idempotency** guarantees exist? Can Starq safely retry a create-payment call with the same merchant reference without creating a duplicate charge?

**Callbacks / webhooks**

23. `BANK_SPEC_REQUIRED` Is there a **server-to-server webhook/callback**, or is the browser redirect the only notification path?
24. `BANK_SPEC_REQUIRED` What is the callback **delivery mechanism** — HTTP method, content type, payload schema, and required response body/status code for acknowledgement?
25. `BANK_SPEC_REQUIRED` What is the **signature format** on the callback — algorithm, which fields are signed, in what canonical order, where the signature is carried (header or body field)?
26. `BANK_SPEC_REQUIRED` How is the **signing secret distributed**, and how is it rotated? Is it distinct between sandbox and production?
27. `BANK_SPEC_REQUIRED` What are the **retry semantics** for a failed callback — how many attempts, over what interval, and does delivery stop permanently after exhaustion?
28. `BANK_SPEC_REQUIRED` Can callbacks arrive **out of order** or be **delivered more than once**? Starq will build for at-least-once delivery, but must know the bank's actual guarantee.
29. `BANK_SPEC_REQUIRED` Is there a **callback replay or resend** facility in the merchant portal for missed notifications?

**Status model**

30. `BANK_SPEC_REQUIRED` Please supply the **complete enumeration of transaction status codes** and their exact meanings — including the distinction between authorised, captured, settled, failed, cancelled, expired, reversed, refunded and partially refunded.
31. `BANK_SPEC_REQUIRED` Is authorisation and capture a **single step** or can they be separated (auth now, capture later)? If separable, what is the authorisation validity window?
32. `BANK_SPEC_REQUIRED` What is the complete **error / decline code** list, with which codes are retryable by the customer and which are permanent?
33. `BANK_SPEC_REQUIRED` Is there a **reason description** field, and is it safe to surface to end customers?

**Refunds**

34. `BANK_SPEC_REQUIRED` Is there a **refund API**, or are refunds only executable through the merchant portal?
35. `BANK_SPEC_REQUIRED` Are **partial refunds** supported, and are multiple partial refunds against one transaction supported up to the original amount?
36. `BANK_SPEC_REQUIRED` What is the **time limit** on refunding a transaction, and how are refunds handled once the original has settled?
37. `BANK_SPEC_REQUIRED` How is a refund reflected in settlement, and is the original MDR refunded to the merchant or retained by the bank?
38. `BANK_SPEC_REQUIRED` Do refunds generate their own **callback**, and with what status codes?

**Settlement**

39. `BANK_SPEC_REQUIRED` What is the **settlement timing** — T+n, cut-off time, and behaviour on weekends and public holidays (including Friday)?
40. `BANK_SPEC_REQUIRED` Is settlement made **gross with fees invoiced**, or **net of fees**?
41. `BANK_SPEC_REQUIRED` Is a **settlement report or reconciliation file** provided? In what format (CSV, XML, MT940, PDF only), delivered how (portal download, SFTP, email), and on what schedule?
42. `BANK_SPEC_REQUIRED` What **key** joins a settlement line to an individual transaction and to the merchant's own order reference? (This determines whether automated reconciliation into starqBooks is possible at all.)
43. `BANK_SPEC_REQUIRED` What **narrative/reference** appears on the merchant's bank statement for a settlement batch?
44. `BANK_SPEC_REQUIRED` What **descriptor** appears on the *cardholder's* statement, and can Starq control it?

**3-D Secure, cards, limits**

45. `BANK_SPEC_REQUIRED` Which **3-D Secure version** is in use, is it mandatory for all transactions, and is the challenge/OTP flow handled entirely within the hosted page?
46. `BANK_SPEC_REQUIRED` Is **liability shift** obtained on 3DS-authenticated transactions, and does it apply to domestic cards?
47. `BANK_SPEC_REQUIRED` Which **card schemes** are supported on this gateway (Visa, Mastercard, Amex, UnionPay, domestic schemes), and is any of them optional/separately priced?
48. `BANK_SPEC_REQUIRED` Are **international (non-Maldivian) cards** accepted on this facility, and are they priced differently?
49. `BANK_SPEC_REQUIRED` What **currencies** can be charged, and what currency will settlement be in? (Starq expects to charge and settle in MVR.)
50. `BANK_SPEC_REQUIRED` What are the **transaction limits** — minimum and maximum single transaction, daily and monthly merchant caps?
51. `BANK_SPEC_REQUIRED` Are **recurring payments** and/or **card-on-file tokenisation** supported on this facility? If so: how is the initial mandate captured, how is the token stored and referenced, does the merchant-initiated transaction skip 3DS, and what are the scheme/consent requirements?
52. `BANK_SPEC_REQUIRED` If recurring is **not** supported, what is the supported pattern for a monthly SaaS subscription — a payment link per cycle, a customer-initiated payment each cycle, or something else?
53. `BANK_SPEC_REQUIRED` Are **payment links** (as distinct from API-created sessions) available, and is that a viable interim before API integration is certified?

**Sandbox and testing**

54. `BANK_SPEC_REQUIRED` How are **sandbox credentials issued** — is a signed merchant agreement a prerequisite, or can development start before commercial approval? (This is the single most schedule-relevant question in this register.)
55. `BANK_SPEC_REQUIRED` What **test card numbers / BIN ranges** are provided, and how are specific outcomes (approve, decline, 3DS challenge, timeout) triggered in sandbox?
56. `BANK_SPEC_REQUIRED` Does the sandbox deliver **real webhooks** to an internet-reachable merchant endpoint, and can that endpoint be a development URL?
57. `BANK_SPEC_REQUIRED` Is there a **certification or UAT sign-off** step before go-live, and what test cases must be demonstrated?
58. `BANK_SPEC_REQUIRED` Is the sandbox merchant ID different from the production merchant ID, and what changes in the integration between the two beyond base URL and credentials?

**Disputes and chargebacks**

59. `BANK_SPEC_REQUIRED` What is the **chargeback process and timeline**, and how is the merchant notified?
60. `BANK_SPEC_REQUIRED` What **evidence** does the bank expect a SaaS merchant to retain and produce in a dispute (signup records, IP/timestamp logs, invoices, usage evidence, acceptance of terms)?
61. `BANK_SPEC_REQUIRED` What are the **chargeback fees**, and is there a chargeback-ratio threshold above which the facility is at risk?
62. `BANK_SPEC_REQUIRED` Are chargebacks and representments visible in the **merchant portal**, and is there an API for them?

**Compliance and contract**

63. `BANK_SPEC_REQUIRED` Given hosted checkout with full redirect and no card data on merchant systems, does the bank agree the correct PCI DSS assessment is **SAQ-A**? What evidence and what renewal cadence does the bank require, and does it require an Attestation of Compliance?
64. `BANK_SPEC_REQUIRED` Does the bank require a **vulnerability scan (ASV)** or penetration test of the merchant's site under SAQ-A?
65. `BANK_SPEC_REQUIRED` Please provide the **card-acceptance terms and conditions** in full ahead of signature — BML's "Terms and Conditions for Card Acceptance" and MIB's "MIB Global Pay Terms & Conditions".
66. `BANK_SPEC_REQUIRED` Does the bank impose any restriction on a merchant holding **facilities with more than one acquirer** simultaneously?
67. `BANK_SPEC_REQUIRED` Are there **website content requirements** the bank enforces before approval (refund policy, terms, privacy, contact details, displayed prices and currency, scheme logos)? Please supply the checklist.
68. `BANK_SPEC_REQUIRED` What is the **notice period and process** for terminating or suspending the facility, from either side?
69. `BANK_SPEC_REQUIRED` What **support channel and SLA** exists for production incidents (gateway outage, settlement failure, callback failure), and what is the escalation path out of hours?
70. `BANK_SPEC_REQUIRED` Does the bank offer or require a **status page / planned-maintenance notification** for the gateway?
71. `BANK_SPEC_REQUIRED` **MIB specifically:** in "submit a fully filled application form and the BR", does "BR" mean Board Resolution or business registration — and please supply the template referred to as "the given format".
72. `BANK_SPEC_REQUIRED` **MIB specifically:** is MIB Global Pay's underlying gateway platform documented to merchants, and does integration follow that platform's standard API or an MIB-specific wrapper?
73. `BANK_SPEC_REQUIRED` **BML specifically:** on the merchant application form, "API Integration required? Yes/No" — what changes in the onboarding path, documentation and timeline between Yes and No?
74. `BANK_SPEC_REQUIRED` **BML specifically:** the form requires "Domain Registration" for API integration. What evidence is accepted, and what is the process if the production domain changes later?

**Count: 74 questions.**

---

## PART C — Sequencing and dependencies

### C.1 The critical-path dependency

> **The settlement account is the blocking dependency, and it is a commercial/governance item, not
> an engineering one.**

A merchant facility settles into an account **in the applicant company's own name**. BML's own form
states the account "should be a Business Account opened with BML in the name of the entity". Starq's
bank mandate is **not yet settled**: the MIB account is in progress under STARQ/BR/2026/003, and BML
is a group-level relationship rather than a Starq Technologies Pvt Ltd account.

Consequences, stated plainly:

- Starq **cannot complete** a merchant application at either bank until it holds a business account
  in its own name at the bank it is applying to (or until that bank confirms it will settle to an
  account elsewhere — question B2).
- Choosing the acquirer is therefore **downstream of** choosing where the operating account lives.
  These two decisions should be taken together, by the founder, as one decision.
- STARQ/BR/2026/003 does **not** authorise card acquiring. A **new board resolution** is required,
  and each bank may demand its own format.

Everything else in this pack can proceed in parallel. This one cannot be worked around.

### C.2 Owners

| Role | Who | Scope |
|---|---|---|
| Founder / Managing Director | Ali Mushthaq Ibrahim | Sole signatory. Bank mandate decision, board resolutions, sealing, all bank-facing commercial contact. Cannot be delegated |
| Engineering | starqERP team | Provider-neutral payment interface, adapters, reconciliation, webhook receiver |
| Documentation / web | starqERP team | Pricing, refund, terms, privacy, contact pages; the company profile document |
| Compliance | Founder, with engineering input | SAQ-A statement, information security statement |

### C.3 Order of work

**Stage 0 — Start now, unblocked (days)**

1. Draft the company profile / product description document (A.8).
2. Write the SAQ-A posture statement and the one-page information security statement (A.30, A.31).
3. Publish the website content pages: pricing, refund/cancellation, terms, privacy, contact and company identity, fulfilment description (A.19–A.25).
4. Confirm and lock the **production domain**, and retain the domain registration evidence (A.17).
5. Build the 12-month volume and average-ticket forecast, honestly labelled as a forecast (A.27, A.28).
6. Regenerate a current MED business portal profile sheet (A.3).
7. **Send Part B to both banks' relationship managers as a written question list.** Do this before, not after, choosing a bank — the answers are how the bank is chosen.

**Stage 1 — The blocking decision (founder only)**

8. Settle the bank mandate: which bank holds Starq Technologies Pvt Ltd's operating account, and therefore which is the primary acquirer.
9. Open/complete the business account in the company's name at that bank.
10. Pass a **new board resolution** authorising the merchant/payment-gateway application, naming authorised signatories and the merchant-portal administrators, in the bank's required format.

**Stage 2 — Application (gated by Stage 1)**

11. Complete the bank's merchant application form, marking API integration required = Yes.
12. Attach: board resolution, MED profile sheet, business activity registration, domain registration, company profile, SAQ-A statement, volume forecast, director ID.
13. Obtain and **read in full** the bank's card-acceptance terms before signing. Confirm the no-surcharge obligation is reflected in billing design.
14. Track to merchant ID issuance and sandbox credential issuance.

**Stage 3 — Engineering, parallel with Stages 0–2**

15. Build the provider-neutral payment interface and the domain model — payment intent, status, refund, settlement record — with the **status enum deliberately left open** until question B30 is answered. Do not populate it with plausible-looking codes.
16. Build the webhook receiver as **signature-verification-pluggable**, with idempotent handling and at-least-once assumptions. Do not implement a signature algorithm until B25 is answered.
17. Build a **stub adapter** and integration tests against it, so that the real adapter is a fill-in once the specification arrives.
18. Treat authoritative status as coming from a server-side verify call, not the browser redirect — subject to confirming that such a call exists (B21).

**Stage 4 — Certification and go-live (gated by Stages 2 and 3)**

19. Implement the real adapter against the issued sandbox credentials and the delivered documentation.
20. Complete the bank's UAT/certification test cases.
21. Production merchant ID, production credentials, controlled first live transaction.
22. Reconciliation into starqBooks against the real settlement file format.

### C.4 Dependency statement

```
Bank mandate decision ──► Business account in company name ──► Board resolution ──► Merchant application
                                                                                            │
                                                             ┌──────────────────────────────┤
                                                             ▼                              ▼
                                                    Sandbox credentials            Merchant ID (prod)
                                                             │                              │
Website content + SAQ-A statement ───────────────────────────┤                              │
                                                             ▼                              ▼
Provider-neutral interface + stub adapter ──────────► Real adapter ──► Certification ──► Go-live
                                                             ▲
                                        Part B answers (status codes, webhook
                                        signature, settlement format, refunds)
```

### C.5 The scheduling point that matters most

**Merchant onboarding is a commercial and compliance process, and it will almost certainly take
longer than the engineering.** The engineering work — a hosted-checkout redirect, a webhook
receiver, and a reconciliation import — is a small, well-understood body of work. The bank side
involves an account opening, a board resolution, a KYC review, a possible inspection, a terms
negotiation and a certification cycle, each with its own queue, and none of them under Starq's
control.

Therefore:

- **Start the bank conversation immediately**, in parallel with code, and specifically **send Part B
  before the application is filed**. The question list is itself a credible opening approach to a
  relationship manager and costs nothing to send.
- **Do not sequence engineering behind the bank.** Build against the stub adapter.
- **Do not sequence the bank behind engineering.** The gateway can be fully built and still sit idle
  for months waiting on a settlement account.
- **Do not guess a specification to unblock a sprint.** An adapter written against an invented status
  model or an invented signature scheme is worse than no adapter, because it will pass its own tests
  and fail against the real bank.

---

## Sources

Primary, retrieved 29 August 2026:

- BML Merchant Application Form (version 1.4), PDF — https://www.bankofmaldives.com.mv/storage/file/54/10867/merchant-application-form-en.pdf
- MIB Global Pay knowledge-base article — https://help.mib.com.mv/portal/en/kb/articles/mib-global-pay

Not retrievable by automated request (HTTP 403) and therefore **not** relied on; obtain manually:

- BML Merchant Services page — https://www.bankofmaldives.com.mv/business-and-sme/business-banking-services/merchant-services
- MIB Global Pay product page — https://www.mib.com.mv/e-banking/online-payment-gateway
- MIB Global Pay Terms & Conditions — https://www.mib.com.mv/downloads/16/download
- MIB Downloads (merchant application form) — https://www.mib.com.mv/downloads

Secondary background only, **not** to be treated as specification:

- MIB launches new online payment gateway — https://psmnews.mv/en/91382
