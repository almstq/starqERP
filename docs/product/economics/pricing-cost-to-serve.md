# StarqERP Pricing and Cost-to-Serve Architecture

This document specifies the pricing architecture and cost-to-serve optimization goals for StarqERP, aligned with the product vision of being a better, cheaper, more accessible local business operating system.

## 1. Pricing Philosophy

**Goal**: StarqERP must be a better product at a cheaper price, with the long-term goal of getting as many Maldivian businesses as possible onto a locally built solution.

### Core Principles
- **Affordable Entry Point**: Micro and SME businesses should be able to start using StarqERP at minimal cost (free or very low monthly fee).
- **Transparent Pricing**: No hidden fees; clear module-based or tiered pricing.
- **Value-Aligned**: Price reflects the actual value delivered to the business tier.
- **No Forced Migration**: As a business grows, it can activate more modules without migrating platforms or data.
- **Local Economic Sensitivity**: Pricing considers Maldivian SME purchasing power and local economic conditions.

### Target Pricing Tiers (Aspirational)
| Tier | Target Monthly Price (MVR) | Target Audience | Included Modules |
|------|----------------------------|-----------------|------------------|
| **Free** | 0 | Micro businesses, freelancers, very small shops | Core accounting (GL, basic AR/AP), basic invoicing, basic reporting |
| **Starter** | 250 | Small businesses, retail shops, small restaurants | Free tier + inventory, purchasing, POS (basic), basic CRM |
| **Professional** | 500 | Growing businesses, medium retail, restaurants with multiple registers | Starter + advanced inventory, advanced CRM, payroll basics, projects |
| **Enterprise** | 1000+ | Larger businesses, chains, resorts, wholesale/distributors | Professional + manufacturing, vertical extensions, advanced analytics, AI automation, dedicated support |

*Note: These targets are aspirational and will be validated against actual cost-to-serve and market testing.*

## 2. Cost-to-Serve Optimization

StarqERP must be architected to minimize the ongoing cost to serve each tenant, enabling affordable pricing while maintaining sustainability.

### Key Cost Components to Optimize
1. **Compute Resources per Tenant**
   - Target: < 0.5 CPU-hours/month for idle SME tenant (10 transactions/day)
   - Strategies: 
     - Tenant-level resource isolation with efficient sharing
     - Lazy loading of modules
     - Event-driven processing (not polling)
     - Efficient database indexing and querying
     - Caching where appropriate (with cache invalidation strategy)

2. **Storage Resources per Tenant**
   - Target: < 50 GB/month for typical SME (including backups)
   - Strategies:
     - Efficient data modeling (avoid redundancy)
     - Compression for historical data
     - Tiered storage (hot/warm/cold)
     - Configurable data retention policies
     - Backup optimization (incremental, deduplication)

3. **AI/Model Cost per Tenant**
   - Target: < MVR 100/month for typical SME usage
   - Strategies:
     - **Intelligent Routing**: 
       - Simple tasks (OCR, categorization) → local/small models (e.g., DistilBERT, TinyLlama)
       - Complex tasks (financial explanation, forecasting) → larger models only when needed
     - **Prompt Optimization**: Minimize token usage through efficient prompting
     - **Caching**: Cache frequent AI requests (e.g., common invoice patterns)
     - **Batch Processing**: Group similar AI requests
     - **Usage Quotas**: Default quotas per tenant with option to purchase more
     - **Model Selection**: Use the smallest model that meets accuracy requirements

4. **OCR/Document Processing Cost**
   - Target: < MVR 0.50 per document processed
   - Strategies:
     - Use efficient OCR engines (Tesseract with custom models, or small transformer-based)
     - Preprocessing to improve accuracy and reduce retries
     - Batch processing of similar documents
     - Configurable OCR confidence thresholds (human-in-the-loop for low confidence)

5. **Messaging/Notification Cost**
   - Target: < MVR 0.10 per message (SMS, email, WhatsApp template)
   - Strategies:
     - Template-based messaging
     - Batch sending where applicable
     - Use of cost-effective channels (WhatsApp business API over SMS where appropriate)
     - Configurable notification frequency (digest vs real-time)

6. **Backup and Disaster Recovery Cost**
   - Target: Included in base cost; efficient incremental backups
   - Strategies:
     - Incremental backups with deduplication
     - Point-in-time recovery snapshots
     - Geo-replication only for higher tiers if needed
     - Regular restore testing to ensure efficiency

7. **Support Burden**
   - Target: Low-touch for self-serve tiers; scalable support for higher tiers
   - Strategies:
     - Comprehensive self-serve documentation and tutorials
     - In-app guided tours and tooltips
     - Community forums and knowledge base
     - Tiered support (email/chat for Starter, phone for Professional/Enterprise)
     - AI-powered help agent for common questions

### Architecture Decisions for Cost Optimization
- **Multi-Tenant Architecture**: Shared infrastructure with strong isolation (tenant ID at every query level)
- **Serverless/FaaS Components**: Where appropriate for sporadic workloads (e.g., AI processing, OCR)
- **Event-Driven Processing**: Reduce idle compute consumption
- **Efficient Data Modeling**: Denormalize only where necessary for performance; avoid redundancy
- **Caching Layers**: Redis/Memcached for frequently accessed reference data (tax rules, product catalogs)
- **Read Replicas**: For reporting workloads to avoid impacting OLTP
- **Blob Storage Optimization**: Use object storage (S3-compatible) for large files (backups, documents) with lifecycle policies
- **Monitoring and Alerting**: Track cost per tenant; alert on anomalies

## 3. Modular Subscription Model

To enable affordable entry and progressive growth, StarqERP will use a modular subscription approach.

### How It Works
- **Base Platform**: Includes core tenant management, security, audit, event bus, and essential workflow engine (always required)
- **Module Entitlements**: Each business function (Inventory, POS, Payroll, etc.) is a separately licensable module
- **Zero-Config Defaults**: Modules come with sensible defaults usable out-of-the-box
- **Activation**: Businesses can activate modules via self-serve portal (subject to payment)
- **Data Continuity**: Activating a module does not require data migration; it begins using existing data immediately
- **Deactivation**: Modules can be deactivated (though data remains accessible; reactivation resumes where left off)

### Example Subscription Path
1. **Micro Business**: Starts with Free tier (Core + Accounting basic)
   - Uses: Invoicing, expense tracking, basic reporting
   - Monthly cost: MVR 0
2. **Growing Retail Shop**: Adds Inventory and POS modules
   - New cost: MVR 250 (Starter tier)
   - Gains: Stock management, sales tracking, barcode scanning, receipt printing
3. **Medium Business with Staff**: Adds Payroll and CRM modules
   - New cost: MVR 500 (Professional tier)
   - Gains: Employee management, payroll processing, customer tracking, follow-ups
4. **Expanding Business**: Adds Manufacturing or vertical extensions
   - New cost: MVR 1000+ (Enterprise tier)
   - Gains: Production planning, shop-floor control, specialized workflows

## 4. Implementation and Data Migration Ease

To encourage adoption from existing systems, StarqERP must make import and migration straightforward.

### Import Capabilities
- **From Spreadsheets**: CSV/XLSX import for masters (products, customers, suppliers, chart of accounts)
- **From Competitor Systems**: 
  - Ewity: Export products, customers, transactions; map to StarqERP equivalents
  - FI-ES/Magnolia: Provided migration tools or scripts (to be developed)
  - Odoo: Standard CSV export/import via Odoo's built-in tools
  - Generic: CSV/XLSX with mapping interface
- **Bank Statements**: CSV/OFX import for reconciliation
- **OCR**: Scan and import invoices/receipts via phone camera

### Export Capabilities
- **Standard Formats**: CSV/XLSX for all masters and transaction data
- **Accounting Exports**: TB, GL, P&L, BS in CSV/XML formats
- **MIRA Ready**: Pre-formatted GST returns for electronic filing
- **API Access**: Full read/write API for custom integrations

## 5. Training and Onboarding Burden

Target: A business should be able to go from sign up to first sale and printed receipt in under 15 minutes with minimal external help.

### Strategies
- **Progressive Onboarding Flow**: 
  1. Sign up (email verification)
  2. Enter business details (name, TIN, activity)
  3. Select initial modules (default: Accounting basic)
  4. Add first product/service
  5. Make first sale (cash or card)
  6. Print receipt
  7. System suggests next steps: "Try adding inventory to track stock"
- **In-App Guidance**: Contextual tooltips, guided tours, walkthroughs
- **Video Tutorials**: Short (2-3 minute) videos for common tasks
- **Knowledge Base**: Searchable articles with screenshots
- **Community Forum**: Peer-to-peer help
- **AI Help Agent**: Answer common questions in natural language (within policy limits)

## 6. Validation and Measurement

To ensure we meet our pricing and accessibility goals, we will track:

### Key Metrics
- **Cost-to-Serve per Tenant per Month**: Measured in MVR (compute, storage, AI, messaging, support allocation)
- **Time to First Sale**: Average time from sign up to first printed receipt (target < 15 minutes)
- **Monthly Active Users (MAU)**: Growth rate of businesses using StarqERP
- **Module Activation Rate**: Percentage of businesses that activate additional modules over time
- **Churn Rate**: Monthly percentage of businesses that stop using StarqERP (target < 5% for SME tiers)
- **Support Ticket Volume**: Tickets per active user per month (target < 0.1 for self-serve tiers)
- **Customer Satisfaction (CSAT)**: Measured via periodic surveys (target > 4.0/5.0)

### Validation Methods
- **Benchmark Testing**: Deploy simulated tenants with realistic workloads; measure resource consumption
- **A/B Testing**: Test different pricing tiers and feature bundles with pilot users
- **Field Trials**: Run pilot programs with real Maldivian businesses; collect feedback and usage data
- **Cost Modeling**: Spreadsheet model of cost components; validate against actual usage metrics

## 7. Relation to Product Principles and Requirements

This specification directly supports:

- **Product Principle 6**: "Price and local adoption are core product requirements"
- **Product Principle 4**: "Simplicity through progressive disclosure"
- **Requirement ECON-001**: Low SaaS operating cost per tenant
- **Requirement CORE-001**: Tenant isolation (enables efficient multi-tenancy)
- **Requirement CORE-002**: Deterministic base verification (enables efficient shared services)
- **Requirement AI-001/AI-002**: AI observe/propose (enables intelligent routing of AI usage)

---
*This specification informs the architecture, roadmap, and task system. It will be updated as we gather actual cost data from prototypes and pilots.*