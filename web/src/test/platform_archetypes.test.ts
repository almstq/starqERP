import { describe, expect, it } from 'vitest';
import { getArchetype, provisionArchetypeDefaults } from '../domain/archetypes';

describe('platform archetype provisioning', () => {
  it('supports materially different tenants from one shared catalog', () => {
    const automotive = provisionArchetypeDefaults('automotive_workshop', 'tenant-a');
    const wholesale = provisionArchetypeDefaults('wholesale_trading', 'tenant-b');

    expect(automotive.archetypeId).toBe('automotive_workshop');
    expect(automotive.workflow.map((item) => item.code)).toEqual(['INTAKE', 'WORK', 'QC', 'COMPLETE']);
    expect(automotive.documentDefaults.orderDocumentLabel).toBe('Job Card');

    expect(wholesale.archetypeId).toBe('wholesale_trading');
    expect(wholesale.workflow.map((item) => item.code)).toEqual(['ORDERED', 'PICKING', 'DISPATCHED']);
    expect(wholesale.documentDefaults.orderDocumentLabel).toBe('Sales Order');
    expect(wholesale.workflow.every((item) => item.tenantId === 'tenant-b')).toBe(true);
    expect(automotive.workflow.some((item) => item.tenantId === 'tenant-b')).toBe(false);
  });

  it('does not mutate the catalog when provisioning defaults', () => {
    const first = provisionArchetypeDefaults('retail', 'tenant-a');
    first.workflow[0].name = 'Changed locally';

    expect(getArchetype('retail').workflow[0].name).toBe('Sale started');
  });

  it('contains all six initial archetypes without customer-specific branches', () => {
    expect(Object.keys({
      general: getArchetype('general_business'),
      automotive: getArchetype('automotive_workshop'),
      wholesale: getArchetype('wholesale_trading'),
      marine: getArchetype('marine_service'),
      construction: getArchetype('construction_contracting'),
      retail: getArchetype('retail'),
    })).toHaveLength(6);
  });
});
