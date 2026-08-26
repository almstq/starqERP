import { describe, it, expect } from 'vitest';
import {
  STARQ_ERP_CANONICAL_METADATA,
  validateProductIdentityMetadata,
} from '../../../contracts/commands';

describe('SERP-032: STARQ ERP Product Metadata & Branding Contract', () => {
  it('verifies canonical product metadata enforces starqERP and starqAI without drift', () => {
    expect(STARQ_ERP_CANONICAL_METADATA.productName).toBe('starqERP');
    expect(STARQ_ERP_CANONICAL_METADATA.embeddedAiName).toBe('starqAI');
    expect(STARQ_ERP_CANONICAL_METADATA.companyName).toBe('Starq Technologies Pvt Ltd');
    expect(STARQ_ERP_CANONICAL_METADATA.baseCurrency).toBe('MVR');

    const validation = validateProductIdentityMetadata(STARQ_ERP_CANONICAL_METADATA);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it('rejects stale starqBooks branding or non-canonical AI branding', () => {
    const staleBranding = {
      productName: 'starqBooks',
      embeddedAiName: 'StarqAI',
      companyName: 'Starq Tech Pvt Ltd',
      baseCurrency: 'MVR',
      version: '0.2.0',
    };

    const validation = validateProductIdentityMetadata(staleBranding);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('starqERP'))).toBe(true);
    expect(validation.errors.some((e) => e.includes('starqAI'))).toBe(true);
  });
});
