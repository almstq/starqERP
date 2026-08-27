import React, { useState } from 'react';
import {
  Sparkles,
  Shield,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Info,
  Terminal,
  Cpu,
  Mail,
  Scale
} from 'lucide-react';
import { STARQ_ERP_CANONICAL_METADATA } from '../../../../contracts/commands';
import { Button, Surface, Badge } from '../ui';
import { StarqBrandLockup } from '../brand/StarqLogo';
import { useTheme } from '../../context/ThemeContext';

export const AboutTab: React.FC = () => {
  const { themeMode, resolvedTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [activeDialog, setActiveDialog] = useState<'privacy' | 'terms' | 'licenses' | null>(null);

  const meta = STARQ_ERP_CANONICAL_METADATA;

  const getSystemInfo = () => {
    return JSON.stringify(
      {
        product: meta.productName,
        version: meta.version,
        releaseTrack: meta.releaseTrack,
        embeddedAi: meta.embeddedAiName,
        company: meta.companyName,
        jurisdiction: meta.legalJurisdiction,
        contact: meta.contactEmail,
        themeMode,
        resolvedTheme,
        environment: (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE || 'production',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  };

  const handleCopyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(getSystemInfo());
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-8 max-w-4xl">
      {/* Product Masthead */}
      <Surface variant="filled" level={1} padding="lg" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--md-sys-color-outline-variant)] pb-6">
          <div className="space-y-3 min-w-0">
            <StarqBrandLockup size="lg" />
            <p className="text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] leading-relaxed max-w-xl">
              Commercial operating system & multi-tenant enterprise resource platform engineered for
              Maldivian SMEs across automotive workshops, boatyards, logistics, and trading operations.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
            <Badge variant="accent" size="md">
              v{meta.version}
            </Badge>
            <span className="text-[11px] font-mono text-[var(--md-sys-color-on-surface-variant)]">
              {meta.releaseTrack}
            </span>
          </div>
        </div>

        {/* Core Attributes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div
            className="p-4 rounded-[var(--md-sys-shape-corner-medium)] space-y-1.5"
            style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}
          >
            <div className="flex items-center gap-2 text-[var(--md-sys-color-primary)] font-semibold">
              <Scale size={15} />
              <span>Corporate Entity</span>
            </div>
            <div className="font-bold text-sm text-[var(--md-sys-color-on-surface)]">
              {meta.companyName}
            </div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
              Registered under Companies Act 7/2023 · Reg No: C29552026 · UEI 2026PV02930B
            </p>
          </div>

          <div
            className="p-4 rounded-[var(--md-sys-shape-corner-medium)] space-y-1.5"
            style={{ backgroundColor: 'var(--md-sys-color-surface-container-high)' }}
          >
            <div className="flex items-center gap-2 text-[var(--md-sys-color-primary)] font-semibold">
              <Sparkles size={15} />
              <span>Embedded AI Capability</span>
            </div>
            <div className="font-bold text-sm text-[var(--md-sys-color-on-surface)]">
              {meta.embeddedAiName}
            </div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
              Zero-retention Maldivian tax & operational intelligence engine built natively into starqERP.
            </p>
          </div>
        </div>
      </Surface>

      {/* Product Particulars & Metadata */}
      <Surface variant="filled" level={1} padding="md" className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)] flex items-center gap-2 border-b border-[var(--md-sys-color-outline-variant)] pb-2.5">
          <Info size={14} className="text-[var(--md-sys-color-primary)]" />
          <span>Product Specifications</span>
        </h3>

        <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs">
          <div>
            <dt className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Canonical Product Name</dt>
            <dd className="font-semibold text-[var(--md-sys-color-on-surface)] mt-0.5">{meta.productName}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Design System SSOT</dt>
            <dd className="font-semibold text-[var(--md-sys-color-on-surface)] mt-0.5">Google Material 3 (M3 Expressive)</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Base Ledger Currency</dt>
            <dd className="font-semibold text-[var(--md-sys-color-on-surface)] mt-0.5">{meta.baseCurrency} (Maldivian Rufiyaa)</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Jurisdiction</dt>
            <dd className="font-semibold text-[var(--md-sys-color-on-surface)] mt-0.5">{meta.legalJurisdiction}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Technical Support</dt>
            <dd className="font-semibold text-[var(--md-sys-color-on-surface)] mt-0.5 flex items-center gap-1">
              <Mail size={12} className="text-[var(--md-sys-color-primary)]" />
              <a href={`mailto:${meta.contactEmail}`} className="hover:underline">{meta.contactEmail}</a>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Tax Compliance Standard</dt>
            <dd className="font-semibold text-[var(--md-sys-color-on-surface)] mt-0.5">MIRA Tax Act (8% GST / DEC-073)</dd>
          </div>
        </dl>
      </Surface>

      {/* Diagnostics Section (Zero sensitive secrets) */}
      <Surface variant="filled" level={1} padding="md" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--md-sys-color-outline-variant)] pb-2.5">
          <div className="flex items-center gap-2">
            <Cpu size={15} className="text-[var(--md-sys-color-primary)]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)]">
              Client Runtime Diagnostics
            </h3>
          </div>

          <Button
            variant="tonal"
            size="xs"
            onClick={handleCopyDiagnostics}
            icon={copied ? <Check size={13} /> : <Copy size={13} />}
          >
            <span>{copied ? 'System Info Copied' : 'Copy System Information'}</span>
          </Button>
        </div>

        <div
          className="p-3 rounded-[var(--md-sys-shape-corner-small)] font-mono text-[11px] leading-relaxed overflow-x-auto select-all"
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            color: 'var(--md-sys-color-on-surface)',
          }}
        >
          <div><strong>Product:</strong> {meta.productName} v{meta.version} ({meta.releaseTrack})</div>
          <div><strong>AI Subsystem:</strong> {meta.embeddedAiName} Native Proxy</div>
          <div><strong>Active Theme:</strong> {themeMode} (resolved: {resolvedTheme})</div>
          <div><strong>Environment:</strong> {(import.meta as unknown as { env?: { MODE?: string } }).env?.MODE || 'production'}</div>
          <div><strong>Operating Jurisdiction:</strong> {meta.legalJurisdiction}</div>
        </div>
      </Surface>

      {/* Legal & Compliance Footing */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-[11px] text-[var(--md-sys-color-on-surface-variant)] border-t border-[var(--md-sys-color-outline-variant)]">
        <div>
          © {new Date().getFullYear()} {meta.companyName}. All rights reserved.
        </div>

        <div className="flex items-center gap-4 font-medium">
          <button
            type="button"
            onClick={() => setActiveDialog('privacy')}
            className="hover:text-[var(--md-sys-color-on-surface)] transition-colors underline-offset-2 hover:underline"
          >
            Privacy Notice
          </button>
          <button
            type="button"
            onClick={() => setActiveDialog('terms')}
            className="hover:text-[var(--md-sys-color-on-surface)] transition-colors underline-offset-2 hover:underline"
          >
            Terms of Service
          </button>
          <button
            type="button"
            onClick={() => setActiveDialog('licenses')}
            className="hover:text-[var(--md-sys-color-on-surface)] transition-colors underline-offset-2 hover:underline"
          >
            Open Source Licences
          </button>
        </div>
      </div>

      {/* Modal Information Surfaces */}
      {activeDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)' }}
          onClick={() => setActiveDialog(null)}
        >
          <div
            className="w-full max-w-lg p-6 rounded-[var(--md-sys-shape-corner-large)] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-3">
              <h4 className="text-sm font-bold capitalize">
                {activeDialog === 'privacy' && 'Enterprise Privacy Policy'}
                {activeDialog === 'terms' && 'Commercial Terms of Service'}
                {activeDialog === 'licenses' && 'Open Source Software Attributions'}
              </h4>
              <Badge variant="neutral" size="sm">Legal Notice</Badge>
            </div>

            <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] leading-relaxed space-y-2 max-h-72 overflow-y-auto pr-1">
              {activeDialog === 'privacy' && (
                <>
                  <p>
                    starqERP operates strictly with multi-tenant data segregation. Tenant operational ledgers, customer records, and financial transactions are cryptographically isolated per organization ID.
                  </p>
                  <p>
                    starqAI operates under a zero-retention guarantee: conversational prompts and financial context are never stored or used for public foundation model training.
                  </p>
                </>
              )}

              {activeDialog === 'terms' && (
                <>
                  <p>
                    Licensed by Starq Technologies Pvt Ltd for enterprise operation under the Maldivian legal jurisdiction. MIRA tax calculations adhere to the Goods and Services Tax Act (Law No. 10/2011).
                  </p>
                  <p>
                    Organizations maintain full provenance, auditability, and legal ownership of all transactional data created within the platform.
                  </p>
                </>
              )}

              {activeDialog === 'licenses' && (
                <>
                  <p>
                    starqERP incorporates open source software including React, Vite, Lucide Icons, and Material Color Utilities under the MIT and Apache 2.0 licenses.
                  </p>
                  <p>
                    Full attribution manifests and third-party license notices are preserved in the repository root compliance directory.
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="filled" size="xs" onClick={() => setActiveDialog(null)}>
                <span>Close</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
