import type { IndustryType, PermissionModule, WorkflowStage } from '../types/erp';

export type ArchetypeId =
  | 'general_business'
  | 'automotive_workshop'
  | 'wholesale_trading'
  | 'marine_service'
  | 'construction_contracting'
  | 'retail';

export interface ArchetypeDefinition {
  id: ArchetypeId;
  name: string;
  industry: IndustryType;
  terminology: {
    customer: string;
    order: string;
    primaryAsset: string;
  };
  enabledModules: PermissionModule[];
  inventoryDefaults: {
    unit: string;
    reorderLevel: number;
  };
  documentDefaults: {
    salesDocumentLabel: string;
    orderDocumentLabel: string;
  };
  workflow: Omit<WorkflowStage, 'id' | 'tenantId'>[];
}

const coreModules: PermissionModule[] = [
  'dashboard', 'invoices', 'payments', 'expenses', 'inventory',
  'purchasing', 'suppliers', 'reports', 'audit', 'roles', 'users', 'settings',
];

const stage = (
  name: string,
  code: string,
  order: number,
  description: string,
  isInitial = false,
  isCompletedStage = false,
): Omit<WorkflowStage, 'id' | 'tenantId'> => ({
  name,
  code,
  order,
  description,
  color: order % 3 === 0 ? 'emerald' : order % 2 === 0 ? 'amber' : 'blue',
  allowedRoleIds: [],
  isInitial,
  isCompletedStage,
});

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDefinition> = {
  general_business: {
    id: 'general_business',
    name: 'General Business',
    industry: 'Custom Service Workshop',
    terminology: { customer: 'Customer', order: 'Order', primaryAsset: 'Item' },
    enabledModules: [...coreModules, 'customers', 'jobs'],
    inventoryDefaults: { unit: 'each', reorderLevel: 0 },
    documentDefaults: { salesDocumentLabel: 'Invoice', orderDocumentLabel: 'Order' },
    workflow: [stage('Order received', 'RECEIVED', 1, 'A new customer order is received.', true), stage('Fulfilled', 'FULFILLED', 2, 'The order is fulfilled.', false, true)],
  },
  automotive_workshop: {
    id: 'automotive_workshop',
    name: 'Automotive / Workshop',
    industry: 'Automotive & Body Repair',
    terminology: { customer: 'Customer', order: 'Job', primaryAsset: 'Vehicle' },
    enabledModules: [...coreModules, 'customers', 'jobs', 'workflows'],
    inventoryDefaults: { unit: 'each', reorderLevel: 5 },
    documentDefaults: { salesDocumentLabel: 'Invoice', orderDocumentLabel: 'Job Card' },
    workflow: [stage('Intake', 'INTAKE', 1, 'Vehicle or equipment is received.', true), stage('Work', 'WORK', 2, 'Approved work is performed.'), stage('Quality check', 'QC', 3, 'Work is inspected.'), stage('Complete', 'COMPLETE', 4, 'The job is ready for handover.', false, true)],
  },
  wholesale_trading: {
    id: 'wholesale_trading',
    name: 'Wholesale / Trading',
    industry: 'Retail & Wholesale Trading',
    terminology: { customer: 'Account', order: 'Sales Order', primaryAsset: 'Product' },
    enabledModules: [...coreModules, 'customers', 'workflows'],
    inventoryDefaults: { unit: 'case', reorderLevel: 10 },
    documentDefaults: { salesDocumentLabel: 'Tax Invoice', orderDocumentLabel: 'Sales Order' },
    workflow: [stage('Order received', 'ORDERED', 1, 'A customer order is accepted.', true), stage('Picking', 'PICKING', 2, 'Inventory is picked for dispatch.'), stage('Dispatched', 'DISPATCHED', 3, 'Goods are dispatched.', false, true)],
  },
  marine_service: {
    id: 'marine_service',
    name: 'Marine / Service',
    industry: 'Marine & Boatyard',
    terminology: { customer: 'Customer', order: 'Service Order', primaryAsset: 'Vessel' },
    enabledModules: [...coreModules, 'customers', 'jobs', 'workflows'],
    inventoryDefaults: { unit: 'each', reorderLevel: 5 },
    documentDefaults: { salesDocumentLabel: 'Service Invoice', orderDocumentLabel: 'Service Order' },
    workflow: [stage('Booking', 'BOOKED', 1, 'A service request is booked.', true), stage('Service', 'SERVICE', 2, 'Marine service is performed.'), stage('Handover', 'HANDOVER', 3, 'The vessel is handed back.', false, true)],
  },
  construction_contracting: {
    id: 'construction_contracting',
    name: 'Construction / Contracting',
    industry: 'Construction & Engineering',
    terminology: { customer: 'Client', order: 'Project', primaryAsset: 'Site' },
    enabledModules: [...coreModules, 'customers', 'jobs', 'workflows'],
    inventoryDefaults: { unit: 'lot', reorderLevel: 2 },
    documentDefaults: { salesDocumentLabel: 'Progress Invoice', orderDocumentLabel: 'Project' },
    workflow: [stage('Tender', 'TENDER', 1, 'A project opportunity is assessed.', true), stage('Mobilised', 'MOBILISED', 2, 'The project is approved and mobilised.'), stage('Completed', 'COMPLETED', 3, 'The contracted work is complete.', false, true)],
  },
  retail: {
    id: 'retail',
    name: 'Retail',
    industry: 'Retail & Wholesale Trading',
    terminology: { customer: 'Customer', order: 'Sale', primaryAsset: 'Product' },
    enabledModules: [...coreModules, 'customers'],
    inventoryDefaults: { unit: 'each', reorderLevel: 5 },
    documentDefaults: { salesDocumentLabel: 'Receipt', orderDocumentLabel: 'Sale' },
    workflow: [stage('Sale started', 'OPEN', 1, 'A sale is opened.', true), stage('Completed', 'COMPLETED', 2, 'Payment and fulfilment are complete.', false, true)],
  },
};

export function getArchetype(id: ArchetypeId): ArchetypeDefinition {
  return ARCHETYPES[id];
}

export function provisionArchetypeDefaults(archetypeId: ArchetypeId, tenantId: string) {
  const definition = getArchetype(archetypeId);
  return {
    archetypeId,
    tenantId,
    enabledModules: [...definition.enabledModules],
    workflow: definition.workflow.map((item, index) => ({ ...item, id: `${tenantId}-stage-${index + 1}`, tenantId })),
    inventoryDefaults: { ...definition.inventoryDefaults },
    documentDefaults: { ...definition.documentDefaults },
  };
}
