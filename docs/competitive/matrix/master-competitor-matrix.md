# Master Competitor Matrix

This matrix compares StarqERP against key competitors across multiple dimensions. Ratings are based on publicly available information from the provided research documents (benchmark.md, benchmark0.md, reverse_engineer_EVETS.md) and general knowledge where noted.

## Rating Scale
- **Depth/Capability**: High / Medium / Low / None
- **Complexity**: Low / Medium / High (lower is better for UX)
- **Onboarding**: Fast / Medium / Slow
- **Compliance**: Full / Partial / Basic / None (Maldives-specific)
- **Automation**: None / Basic / Advanced
- **AI Capability**: None / Bolt-on / Native
- **Support**: Local / Partner / None
- **Pricing**: Relative (Free / Low / Medium / High) - based on publicly verifiable info
- **Yes/No**: ✅ / ❌

## Competitors
1. Ewity
2. FI-ES Magnolia
3. IDZlink
4. Odoo
5. EVETS
6. Platto
7. Qvian
8. EquityPOS
9. LeadPOS
10. RevSol
11. Microsoft Dynamics 365
12. Oracle Fusion Cloud ERP
13. SAP S/4HANA Cloud

## Matrix

| Dimension | Ewity | FI-ES Magnolia | IDZlink | Odoo | EVETS | Platto | Qvian | EquityPOS | LeadPOS | RevSol | Dynamics 365 | Oracle Fusion | SAP S/4HANA |
|-----------|-------|----------------|---------|------|-------|--------|-------|-----------|---------|--------|--------------|---------------|-------------|
| **Accounting Depth** | Low (relies on QuickBooks/Xero) | High (full GL/AP/AR) | Medium (claims accounting) | High (full GL/AP/AR) | Medium (claims double-entry but shallow docs) | Low (F&B focus) | Medium (claims double-entry) | Low (POS focus) | Low (POS focus) | Low (POS/eCommerce focus) | High (full ERP) | High (full ERP) | High (full ERP) |
| **Procurement Depth** | Low (basic PO) | High (import workflow w/ forward costing) | Medium | High (full procure-to-pay) | Low-Medium (claimed but shallow) | Medium (F&B procurement) | Low-Medium | Low | Low | Low | High | High | High |
| **Inventory Costing** | Low (basic FIFO?) | Medium (standard costing) | Low-Medium | High (multiple methods, landed cost) | Low-Medium (claimed import costing) | Low (F&B) | Low-Medium | Low | Low | Low | High | High | High |
| **POS Capability** | High (feature-rich) | Medium (standard retail) | Medium | High (full-featured) | High (separate configs) | High (F&B specialized) | Medium | High (POS focus) | High (POS focus) | Medium (POS/eCommerce) | High | High | High |
| **Multi-Branch Support** | Medium (multi-location) | High (established) | Medium | High (unlimited warehouses) | High (multi-location) | Medium | Low-Medium | High | High | Medium | High | High | High |
| **API/Extensibility** | Low-Medium (integrations) | Low (legacy) | Low-Medium | High (public API, Studio, webhooks) | Low-Medium (claimed APIs) | Low-Medium | Low | Low | Low | Low | High (Power Platform) | High (REST, SOAP) | High (OData, APIs) |
| **Configurability** | Low (limited settings) | Low (hardcoded) | Low-Medium | High (workflows, rules, custom fields) | Low-Medium | Low-Medium | Low | Low | Low | Low | High (Power Apps, Flow) | High (extensible) | High (extensible) |
| **Local Support** | High (Maldives-based) | High (Maldives-incorporated) | Low (unknown) | Medium (via partners) | High (Maldives-specific material) | High (Maldives-focused) | High (Maldives-built) | High (Maldives-focused) | High (Maldives-focused) | High (Maldives-focused) | Low (global) | Low (global) | Low (global) |
| **Implementation Burden** | Low (self-serve) | Medium-High (consultant-led) | Unknown | High (partner-led) | Medium (claimed but unclear) | Low-Medium | Low | Low | Low | Low | High | High | High |
| **Likely Customer Segment** | Micro/SME | Established businesses | Unknown | All sizes (SME to Enterprise) | All sizes (claimed) | F&B SME | Micro/SME | Micro/SME | Micro/SME | Micro/SME | SME to Enterprise | Enterprise | Enterprise |
| **Pricing (Publicly Verifiable)** | Free - MVR 750/month | Unknown (likely license+support) | Unknown | $24.90-$49/user/mo + impl. | MVR 8,500-85,000/mo (currency unclear) | Unknown | Unknown | Free - MVR 700/mo | Free - MVR 400/mo | Unknown | Unknown (per user/app) | Unknown (subscription) | Unknown (subscription) |
| **Offline Support** | Yes (offline operation) | Unknown | Unknown | Yes (offline operation) | Yes (offline-safe) | Unknown | Unknown | Unknown | Unknown | Unknown | Yes (with sync) | Yes (with sync) | Yes (with sync) |
| **UX Complexity** | Low (simple, beautiful) | Medium-High (dated) | Unknown | Medium-High (configurable overwhelms) | Medium (claimed Maldives-specific) | Low-Medium (F&B focus) | Low (POS focus) | Low (POS focus) | Low (POS focus) | Low (POS/eCommerce) | Medium-High (complex) | Medium-High | Medium-High |
| **Automation Level** | Low (basic workflows) | Low-Medium (some automation) | Low | High (workflow automation) | Medium (marketed workflows) | Low-Medium | Low | Low | Low | Low | High (Power Automate) | High | High |
| **Native AI Capability** | None | None | None | None (bolt-on modules) | None (bolt-on services) | None | None | None | None | None | None (Copilot add-on) | None | None |
| **HR/Payroll Depth** | None | Medium (attendance, leave) | Low-Medium | High (full stack) | Medium (claimed) | Low (F&B) | Low | Low | Low | Low | High | High | High |
| **Projects/Job Costing** | None | Low-Medium | Low | High (full) | Medium (claimed) | Low | Low | Low | Low | Low | High | High | High |
| **Manufacturing Depth** | None | Low-Medium | Low | High (MRP, shop-floor) | Low-Medium (claimed) | Low (F&B) | Low | Low | Low | Low | High | High | High |
| **CRM Depth** | Medium (lightweight) | Low (basic) | Low-Medium | High (full) | Medium (claimed) | Low (F&B) | Low | Low | Low | Low | High | High | High |
| **Reporting Depth** | Medium (basic reports) | Medium (standard reports) | Low-Medium | High (extensive analytics) | Medium (claimed reports) | Low-Medium | Low | Low | Low | Low | High | High | High |
| **Multi-Currency** | Yes (multi-currency) | Yes | Unknown | Yes (native) | Yes (MVR+USD) | Unknown | Unknown | Unknown | Unknown | Unknown | Yes | Yes | Yes |
| **Maldives Tax Compliance** | Yes (MVR, MIRA reports) | Yes (local knowledge) | Unknown | Medium (via partners) | **Flaw: 16% TGST claimed despite 17% since Jul 2025** | Unknown | Unknown | Unknown | Unknown | Unknown | Low (global) | Low (global) | Low (global) |
| **Import/Landed Costing** | Low (basic) | High (import procurement w/ forward costing) | Low-Medium | High (landed cost engine) | Medium (claimed import costing) | Low (F&B) | Low-Medium | Low | Low | Low | High | High | High |
| **Inter-Island Logistics** | Low (basic multi-loc) | Low (unknown) | Low | Low (generic transfers) | Medium (cargo manifests claimed) | Low (F&B) | Low | Low | Low | Low | Low | Low | Low |
| **Whitespace for Notes** |  |  |  |  | *EVETS TGST claim outdated per MIRA* |  |  |  |  |  |  |  |  |

## Legend
- **High/Medium/Low**: Relative capability depth
- **Yes/No**: Binary capability
- **Fast/Medium/Slow**: Onboarding speed
- **Full/Partial/Basic/None**: Compliance depth
- **None/Bolt-on/Native**: AI integration maturity
- **Local/Partner/None**: Support model
- **Free/Low/Medium/High**: Relative pricing (based on public info)

## Sources
- Ewity: benchmark.md lines 11-306
- FI-ES Magnolia: benchmark.md lines 721-868
- IDZlink: benchmark.md lines 871-893
- Odoo: benchmark.md lines 302-718
- EVETS: benchmark0.md + reverse_engineer_EVETS.md
- Platto: benchmark.md lines 1043-1070
- Qvian: benchmark.md lines 976-998
- EquityPOS: benchmark.md lines 941-972
- LeadPOS: benchmark.md lines 1001-1022
- RevSol: benchmark.md lines 1023-1041
- Dynamics 365/Oracle/SAP: general knowledge (not deeply covered in provided sources; marked as Unknown where no public info in research)

## Notes
1. Matrix focuses on dimensions relevant to Maldives SME market and ERP value.
2. Where competitor documentation is lacking in provided sources, marked as Unknown.
3. StarqERP target state is implicit: aims for High in accounting depth, procurement depth, inventory costing, configurability, automation, native AI, low UX complexity, fast onboarding, low implementation burden, Maldives-native support/compliance, affordable pricing.
4. This matrix will inform requirement registry priorities and architectural decisions.