# SB-FND-002 — standards position and claims policy

Version: 0.1  
Status: controlled working baseline  
Effective date: 2026-08-20

## Position

STARQ ERP is **ISO-aligned from day 0**. This means applicable principles and controls are translated into product requirements, engineering practices, tests and retained evidence.

It does not mean the product or organisation is certified. Certification requires an appropriate scope, an operating management system, sufficient records and an independent audit by a competent certification body.

## Evidence states

| State | Meaning | Permitted claim |
|---|---|---|
| Aligned | A relevant standard informed requirements and controls | “Designed using an ISO-aligned engineering baseline” |
| Internally verified | Named requirements have implementation and review evidence | “Internally verified against the stated control baseline” |
| Conformant | A defined scope has objective evidence against every applicable requirement | Only with the scope, version, method and assessor stated |
| Certified | An accredited external certification process issued a valid certificate | Only the exact certified organisation, system, scope and standard |

Marketing and interface copy must not collapse these states.

## Day-0 standards profile

| Reference | Use in the foundation engine | Initial application |
|---|---|---|
| ISO/IEC/IEEE 12207:2026 | Software lifecycle control | Requirements, architecture, implementation, verification, release, operation, maintenance and retirement records |
| ISO/IEC 25010:2023 | Product quality model | Quality objectives and measurable acceptance criteria |
| ISO/IEC 27001:2022 | Information-security management | Risk treatment, access control, secrets, incidents, suppliers and continual improvement |
| ISO 9001:2015/Amd 1:2024 | Quality-management discipline | Process ownership, controlled information, corrective action and evidence-based improvement |
| ISO/IEC/IEEE 90003:2018 | Applying quality management to software | Software-specific interpretation of quality controls |
| ISO 22301:2019/Amd 1:2024 | Business continuity | Recovery objectives, backup, restore and disruption exercises |
| ISO 31000:2018 | Risk-management guidance | Risk identification, treatment, ownership, review and communication |
| OWASP ASVS 5.0.0 Level 2 | Application-security verification | Authentication, session, authorization, validation, API and data-protection tests |
| WCAG 2.2 Level AA | Accessible interface baseline | Keyboard, focus, contrast, target size, authentication and error handling |

Standards versions are reviewed at least annually and whenever a referenced standard is revised. A new edition is assessed before adoption; it is not silently treated as applicable.

## Traceability rule

Every applicable requirement receives:

- a stable internal requirement ID;
- source and version;
- applicability and rationale;
- owner;
- design or implementation reference;
- verification method;
- evidence location;
- status and review date.

The traceability register is the control surface. A standards name in a document without mapped evidence is context, not conformance.

## Public wording

Preferred:

> Built on an ISO-aligned quality, security and software-lifecycle foundation from day 0.

When additional precision is needed:

> the foundation engine uses documented controls informed by ISO/IEC 25010, ISO/IEC 27001 and ISO/IEC/IEEE 12207. It is not currently represented as ISO certified.

## Sources

- https://www.iso.org/standard/90219.html
- https://www.iso.org/standard/78176.html
- https://www.iso.org/publication/PUB100484.html
- https://www.iso.org/standard/62085.html
- https://www.iso.org/standard/74348.html
- https://www.iso.org/standard/75106.html
- https://www.iso.org/standard/65694.html
- https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release
- https://www.w3.org/TR/WCAG22/
