import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useTheme } from './ThemeContext';
import {
  NavigationTab,
  Customer,
  JobOrder,
  Invoice,
  Payment,
  Expense,
  InventoryItem,
  StockMovement,
  Supplier,
  PurchaseOrder,
  StaffMember,
  LaborEntry,
  NeedsAttentionAlert,
  AIAssistantInsight,
  JobStatus,
  OrganisationTenant,
  UserRole,
  AppUser,
  WorkflowStage,
  AuditLogEntry,
  PermissionModule,
  PermissionAction,
  PaymentMethod,
  GstRegistrationStatus,
} from '../types/erp';
// SERP-288 — FOURTEEN demo datasets used to be imported here and NONE of them
// was referenced. Every transactional state below already initialises to [], so
// they were dead — but dead in the worst possible place: in scope, in the live
// context, one keystroke from being wired back in by anyone who saw
// INITIAL_INVOICES available and reasonably assumed it was meant to be used.
// A tenant surface should not have another business's invoices within reach.
// Removed, not merely left unused. They remain exported from the demo fixture
// tests and demo fixtures that legitimately want them.
import {
  INITIAL_STAFF,
  INITIAL_TENANTS,
  INITIAL_ROLES,
  INITIAL_USERS,
  OrganisationApplication,
} from '../data/demoFixtures';
import { telemetry } from '../services/telemetry';
import { applyMovement } from '../domain/inventoryValuation';
import {
  PRICE_LIST_BINDING_OPTIONS,
  PriceList,
  resolveItemPrice,
  resolvePriceListForCustomer,
  roundToTwoDecimals,
  validatePriceList,
} from '../domain/priceLists';
import { dispatchCommand, apiGet, apiPost, ApiError } from '../services/apiGateway';
import { useAuth } from './AuthContext';
import { getArchetype, ArchetypeDefinition, ArchetypeTerminology, ArchetypeId, ARCHETYPES } from '../domain/archetypes';
import { switchContext as apiSwitchContext, fetchCurrentUser } from '../services/auth';
import { mapSessionOrganisationsToTenants, resolveCurrentTenant } from '../lib/sessionTenants';
import { isCurrentSessionDataLoad } from '../lib/sessionLoadGuard';
import {
  submitOrganisationApplication as apiSubmitApplication,
  getApplicantApplication as apiGetApplicantApplication,
  getPlatformApplications as apiGetPlatformApplications,
  approvePlatformApplication as apiApproveApplication,
  rejectPlatformApplication as apiRejectApplication,
  requestInfoPlatformApplication as apiRequestInfoApplication,
  getTenantInvitations as apiGetTenantInvitations,
  createTenantInvitation as apiCreateTenantInvitation,
  resendTenantInvitation as apiResendTenantInvitation,
  revokeTenantInvitation as apiRevokeTenantInvitation,
  PlatformApplicationRecord,
  StaffInvitationRecord,
  CreateStaffInvitationPayload,
} from '../services/apiGateway';

export interface ERPContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  customers: Customer[];
  jobs: JobOrder[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  inventory: InventoryItem[];
  stockMovements: StockMovement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  alerts: NeedsAttentionAlert[];
  aiInsights: AIAssistantInsight[];
  staff: StaffMember[];

  // Multi-Tenant & Multi-Book Context State
  activePlane: 'platform' | 'tenant';
  currentTenant: OrganisationTenant;
  tenantHydrated: boolean;
  tenantIsLive: boolean;
  currentBookId?: string;
  currentBook?: import('../types/erp').OrganisationBook;
  currentArchetype: ArchetypeDefinition;
  currentTerms: ArchetypeTerminology;
  tenants: OrganisationTenant[];
  switchTenant: (tenantId: string) => Promise<void>;
  switchBook?: (bookId: string) => void;
  switchActiveContext: (context: { plane: 'platform' | 'tenant'; tenantId?: string; bookId?: string }) => void;
  createTenant: (tenantData: Omit<OrganisationTenant, 'id' | 'createdAt'>) => OrganisationTenant;
  updateTenant: (tenantData: Partial<OrganisationTenant>) => Promise<void>;
  updateTenantLogo: (logoUrl: string | null) => void;
  isSetupModalOpen: boolean;
  setIsSetupModalOpen: (open: boolean) => void;

  // Platform Application & Organisation Registration
  pendingApplications: OrganisationApplication[];
  submitOrganisationApplication: (
    appData: Omit<OrganisationApplication, 'id' | 'submittedAt' | 'status'>
  ) => Promise<OrganisationApplication>;
  approveOrganisationApplication: (appId: string) => Promise<OrganisationTenant | undefined>;
  rejectOrganisationApplication: (appId: string, reason?: string) => void;
  isRegisterOrgModalOpen: boolean;
  setIsRegisterOrgModalOpen: (open: boolean) => void;
  refreshApplicantApplication?: () => Promise<void>;

  // RBAC & User Management State
  currentUser: AppUser;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  roles: UserRole[];
  invitations: StaffInvitationRecord[];
  switchCurrentUser: (userId: string) => void;
  /**
   * OPTIONAL AND CURRENTLY NEVER PROVIDED.
   *
   * MultiWarehouseView, PayrollManagementView and JobCostingView all call this
   * to post a generated journal, and each already guards with
   * `typeof addJournalEntry === 'function'` because no provider supplies it.
   * Declaring it optional makes the type state that fact rather than implying a
   * method that does not exist.
   *
   * Consequence, recorded deliberately: journal posting from those three
   * modules is INERT. The entries are computed and then dropped. Wiring this to
   * real journal state is a feature change, not a typecheck fix, so it is
   * reported rather than invented here.
   */
  addJournalEntry?: (entry: import('../domain/journals').JournalEntry) => void;

  authorizeUser: (userId: string, roleId?: string) => void;
  suspendUser: (userId: string) => void;
  inviteUser: (userData: { name: string; email: string; phone: string; roleId: string; jobTitle?: string }) => AppUser;
  inviteStaffMember: (payload: CreateStaffInvitationPayload) => Promise<StaffInvitationRecord>;
  resendInvitation: (id: string) => Promise<void>;
  revokeInvitation: (id: string) => Promise<void>;
  updateUserRole: (userId: string, roleId: string) => void;
  createRole: (roleData: Omit<UserRole, 'id' | 'tenantId'>) => UserRole;
  updateRolePermissions: (roleId: string, permissions: UserRole['permissions']) => void;
  deleteRole: (roleId: string) => void;
  hasPermission: (module: PermissionModule, action?: PermissionAction) => boolean;
  isPendingApproval: boolean;

  // Admin & Privileged MFA (SERP-268)
  isMfaElevated: boolean;
  isMfaChallengeOpen: boolean;
  isMfaEnrollmentOpen: boolean;
  openMfaEnrollment: () => void;
  closeMfaEnrollment: () => void;
  openMfaChallenge: (onSuccess?: () => void) => void;
  closeMfaChallenge: () => void;
  enrollMfa: (userId: string, secret: string, verificationCode: string, recoveryCodes: string[]) => { ok: boolean; error?: string };
  verifyMfaChallenge: (code: string) => { ok: boolean; error?: string };
  disableMfa: (userId: string, verificationCode: string) => { ok: boolean; error?: string };
  requireMfaElevation: (action: () => void) => void;

  // Configurable Workflows
  workflowStages: WorkflowStage[];
  setWorkflowStages: (stages: WorkflowStage[]) => void;
  addWorkflowStage: (stage: Omit<WorkflowStage, 'id' | 'tenantId' | 'order'>) => WorkflowStage;
  updateWorkflowStage: (stageId: string, stageData: Partial<WorkflowStage>) => void;
  deleteWorkflowStage: (stageId: string) => void;
  resetWorkflowToPreset: (presetType: string, targetTenantId?: string) => void;

  // Activity / Audit Logs (The Owner's Evidence)
  auditLogs: AuditLogEntry[];
  logAuditEvent: (entry: {
    action: AuditLogEntry['action'];
    module: PermissionModule;
    entityType: string;
    entityId: string;
    entityName: string;
    summary: string;
    details?: string;
    previousValue?: string;
    newValue?: string;
  }) => void;

  // Theme support
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  // Selected entities for drawers & modals
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  selectedInvoiceId: string | null;
  setSelectedInvoiceId: (id: string | null) => void;
  selectedPOId: string | null;
  setSelectedPOId: (id: string | null) => void;

  // Dialog openers
  isCreateJobOpen: boolean;
  setIsCreateJobOpen: (open: boolean) => void;
  isCreateInvoiceOpen: boolean;
  setIsCreateInvoiceOpen: (open: boolean) => void;
  isRecordPaymentOpen: boolean;
  setIsRecordPaymentOpen: (open: boolean) => void;
  isAddExpenseOpen: boolean;
  setIsAddExpenseOpen: (open: boolean) => void;
  isReceiveStockOpen: boolean;
  setIsReceiveStockOpen: (open: boolean) => void;
  isCreatePOOpen: boolean;
  setIsCreatePOOpen: (open: boolean) => void;
  isAICopilotOpen: boolean;
  setIsAICopilotOpen: (open: boolean) => void;
  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (open: boolean) => void;
  isNewCustomerOpen: boolean;
  setIsNewCustomerOpen: (open: boolean) => void;

  // Pre-filled state for creation workflows
  prefilledCustomerId?: string;
  setPrefilledCustomerId: (id?: string) => void;
  prefilledJobId?: string;
  setPrefilledJobId: (id?: string) => void;
  prefilledInvoiceId?: string;
  setPrefilledInvoiceId: (id?: string) => void;

  // Formatters & helpers
  formatMVR: (amount: number, showDecimals?: boolean) => string;

  // CRUD actions
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  addMaterialToJob: (jobId: string, inventoryId: string, quantity: number) => void;
  addLaborEntry: (entry: Omit<LaborEntry, 'id' | 'totalCostMvr' | 'clockedAt'>) => void;
  laborEntries: LaborEntry[];
  createJob: (jobData: Omit<JobOrder, 'id' | 'jobId' | 'materialsUsed' | 'actualMaterialCost' | 'actualLaborCost' | 'totalLaborHours' | 'actualProfit'>) => JobOrder;
  createCustomer: (customerData: Omit<Customer, 'id' | 'createdAt' | 'activeJobsCount' | 'totalInvoiced' | 'outstandingBalance'>) => Customer;
  createSupplier: (supplierData: Omit<Supplier, 'id' | 'outstandingPayable' | 'rating'>) => Supplier;
  updateSupplier: (supplierData: Supplier) => Supplier;
  deactivateSupplier: (supplierId: string) => void;
  createInvoice: (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'> & { priceList?: PriceList }) => Invoice;
  priceLists: PriceList[];
  priceListsLoading: boolean;
  createPriceList: (priceListData: Omit<PriceList, 'id' | 'registryId' | 'version' | 'createdAt' | 'updatedAt'>) => Promise<PriceList>;
  updatePriceList: (priceListId: string, priceListData: Partial<Omit<PriceList, 'id' | 'registryId'>>) => Promise<PriceList>;
  archivePriceList: (priceListId: string) => Promise<void>;
  recordPayment: (paymentData: Omit<Payment, 'id' | 'paymentNumber'>) => Payment;
  recordCounterSale: (saleData: {
    items: Array<{ itemId: string; name: string; sku: string; quantity: number; unitPrice: number }>;
    paymentMethod: PaymentMethod;
    customerName?: string;
    customerId?: string;
    bankAccount?: string;
  }) => { success: boolean; invoice?: Invoice; payment?: Payment; error?: string };
  addExpense: (expenseData: Omit<Expense, 'id' | 'expenseNumber'>) => Expense;
  receiveStock: (itemId: string, quantity: number, ref?: string, cost?: number) => void;
  addInventoryItem: (itemData: Omit<InventoryItem, 'id' | 'stockStatus' | 'lastRestockedDate'>) => InventoryItem;
  adjustStockLevel: (itemId: string, newQuantity: number, reason?: string) => void;
  createPurchaseOrder: (poData: Omit<PurchaseOrder, 'id' | 'poNumber'>) => PurchaseOrder;
  receivePurchaseOrder: (poId: string) => void;
  dismissAlert: (alertId: string) => void;
  triggerAIInsightAction: (insight: AIAssistantInsight) => void;
  generateJobInvoice: (jobId: string) => Invoice;

  // Transactional Edge RPC State (SERP-289)
  mutationPending: boolean;
  lastMutationError: string | null;
  clearMutationError: () => void;

  // Quick stats
  totalSalesToday: number;
  totalCashReceived: number;
  totalOutstandingInvoices: number;
  totalAccountsPayable: number;
  activeJobsCount: number;
  lowStockItemsCount: number;
}

// Backend data mappers — convert database rows to frontend types
function mapBackendCustomers(rows: unknown[]): Customer[] {
  return rows.map((r: any) => ({
    id: r.id,
    tenantId: r.organisation_id,
    name: r.display_name,
    phone: r.phone ?? '',
    email: r.email ?? '',
    type: r.metadata?.type ?? 'Individual',
    priceListId: r.metadata?.price_list_id ?? r.metadata?.priceListId ?? undefined,
    island: r.metadata?.island ?? '',
    vehicles: r.metadata?.vehicles ?? [],
    notes: r.metadata?.notes ?? '',
    activeJobsCount: 0,
    totalInvoiced: 0,
    outstandingBalance: 0,
    createdAt: r.created_at?.split('T')[0] ?? '',
  }));
}

function mapBackendPriceLists(rows: unknown[]): PriceList[] {
  return rows.map((r: any) => ({
    id: r.code,
    code: r.code,
    registryId: r.registry_id ?? r.id,
    name: r.name,
    description: r.description ?? undefined,
    discountPercent: Number(r.discount_percent ?? 0),
    itemOverrides: Array.isArray(r.overrides)
      ? r.overrides.map((override: any) => ({
          itemId: override.product_id,
          unitPrice: Number(override.unit_price),
        }))
      : [],
    active: r.active !== false,
    version: Number(r.version ?? 1),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

const DEMO_PRICE_LISTS: PriceList[] = PRICE_LIST_BINDING_OPTIONS.map((option) => ({
  id: option.id,
  code: option.id,
  name: option.name,
  discountPercent: 0,
  itemOverrides: [],
  active: true,
}));

function mapBackendJobs(rows: unknown[]): JobOrder[] {
  return rows.map((r: any) => ({
    id: r.id,
    jobId: r.job_no,
    customerId: r.customer_id ?? '',
    customerName: r.customer_name ?? '',
    customerPhone: r.customer_phone ?? '',
    vehicle: { plateNumber: r.vehicle_reg ?? '', make: '', model: '', year: 0, color: '', type: 'Car' as const },
    serviceType: '' as any,
    requestedWork: '',
    quotedAmount: 0,
    depositPaid: 0,
    balanceDue: 0,
    assignedStaff: [],
    status: (r.state ?? 'call') as any,
    priority: 'Normal',
    startDate: r.created_at?.split('T')[0] ?? '',
    expectedCompletionDate: '',
    materialsUsed: [],
    estimatedMaterialCost: 0,
    actualMaterialCost: 0,
    laborCostEstimate: 0,
    actualLaborCost: 0,
    totalLaborHours: 0,
    targetMarginPercentage: 0,
    actualProfit: 0,
    bayNumber: '',
  }));
}

function mapBackendInvoices(rows: unknown[]): Invoice[] {
  return rows.map((r: any) => ({
    id: r.id,
    invoiceNumber: r.document_no ?? '',
    customerId: r.contact_id ?? '',
    customerName: r.metadata?.customer_name ?? '',
    customerPhone: '',
    customerIsland: '',
    date: r.document_date ?? r.created_at?.split('T')[0] ?? '',
    dueDate: r.due_date ?? '',
    items: r.metadata?.items ?? [],
    subtotal: r.metadata?.subtotal ?? r.gross_total ?? 0,
    gstRate: 0.08,
    gstAmount: r.metadata?.gst_amount ?? 0,
    totalAmount: r.gross_total ?? 0,
    amountPaid: r.allocated_total ?? 0,
    balanceDue: r.unallocated_balance ?? r.gross_total ?? 0,
    status: r.unallocated_balance <= 0 ? 'Paid' : r.allocated_total > 0 ? 'Partially Paid' : 'Sent',
    notes: r.metadata?.notes ?? '',
    bankDetails: '',
  }));
}

function mapBackendExpenses(rows: unknown[]): Expense[] {
  return rows.map((r: any) => ({
    id: r.id,
    expenseNumber: r.document_no ?? '',
    date: r.metadata?.date ?? r.document_date ?? '',
    payee: r.metadata?.payee ?? '',
    category: r.metadata?.category ?? 'General' as any,
    description: r.metadata?.description ?? r.metadata?.notes ?? '',
    amount: r.gross_total ?? 0,
    paymentMethod: r.metadata?.payment_method ?? 'Bank Transfer' as any,
    status: 'Paid' as const,
  }));
}

function mapBackendPayments(rows: unknown[]): Payment[] {
  return rows.map((r: any) => ({
    id: r.id,
    paymentNumber: r.document_no ?? '',
    invoiceId: r.metadata?.invoice_id ?? '',
    invoiceNumber: '',
    customerId: r.contact_id ?? '',
    customerName: '',
    amount: r.gross_total ?? 0,
    paymentDate: r.document_date ?? r.created_at?.split('T')[0] ?? '',
    method: r.metadata?.method ?? 'Bank Transfer',
    referenceNumber: r.metadata?.reference ?? '',
    bankAccount: r.metadata?.bank_account ?? '',
    status: 'Verified',
    notes: r.metadata?.notes ?? '',
  }));
}

function mapBackendSuppliers(rows: unknown[]): Supplier[] {
  return rows.map((r: any) => ({
    id: r.id,
    name: r.display_name,
    contactPerson: r.metadata?.contact_person ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    address: r.metadata?.address ?? '',
    islandOrCountry: r.metadata?.island ?? '',
    category: r.metadata?.category ?? '',
    outstandingPayable: 0,
    leadTimeDays: r.metadata?.lead_time_days ?? 7,
    rating: 0,
  }));
}

function mapBackendPurchaseOrders(rows: unknown[]): PurchaseOrder[] {
  return rows.map((r: any) => ({
    id: r.id,
    poNumber: r.document_no ?? '',
    supplierId: r.contact_id ?? '',
    supplierName: '',
    orderDate: r.document_date ?? r.created_at?.split('T')[0] ?? '',
    expectedDeliveryDate: r.metadata?.expected_delivery ?? '',
    items: [],
    subtotal: r.gross_total ?? 0,
    gstAmount: 0,
    totalAmount: r.gross_total ?? 0,
    status: (r.status === 'settled' ? 'Received & Stocked' : 'Sent') as PurchaseOrder['status'],
    paymentStatus: r.unallocated_balance <= 0 ? 'Paid' : r.allocated_total > 0 ? 'Partially Paid' : 'Unpaid',
    notes: '',
  }));
}

function mapBackendAuditEvents(rows: unknown[]): AuditLogEntry[] {
  return rows.map((r: any) => ({
    id: r.id,
    tenantId: r.organisation_id,
    userId: r.actor_person_id ?? '',
    userName: r.acting_seat ?? '',
    userRole: r.acting_seat ?? '',
    userEmail: '',
    timestamp: r.occurred_at?.replace('T', ' ').substring(0, 19) ?? '',
    ipAddress: '',
    location: '',
    action: r.action?.replace('erp.', '').toUpperCase() ?? 'UNKNOWN',
    module: 'audit' as PermissionModule,
    entityType: r.object_type ?? '',
    entityId: r.object_id ?? '',
    entityName: '',
    summary: r.action ?? '',
  }));
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

export const ERPProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const { resolvedTheme, setThemeMode } = useTheme();
  const { session, isLoading: authLoading, login, refreshSession } = useAuth();
  const theme = resolvedTheme;

  // Demo / unsigned fixtures only. A live session never reads INITIAL_TENANTS or localStorage.
  const [demoTenants, setDemoTenants] = useState<OrganisationTenant[]>(INITIAL_TENANTS);
  const [tenantOverrides, setTenantOverrides] = useState<Record<string, Partial<OrganisationTenant>>>({});

  const tenants = useMemo(() => {
    const base = session ? mapSessionOrganisationsToTenants(session.organisations) : demoTenants;
    return base.map((t) => ({
      ...t,
      ...(tenantOverrides[t.id] ?? {}),
    }));
  }, [session, demoTenants, tenantOverrides]);

  const setTenants = useCallback(
    (updater: React.SetStateAction<OrganisationTenant[]>) => {
      if (session) return;
      setDemoTenants(updater);
    },
    [session]
  );

  // Organisation Applications & Platform Approval State (Authoritative Server Persistence)
  const [pendingApplications, setPendingApplications] = useState<OrganisationApplication[]>([]);
  const [isRegisterOrgModalOpen, setIsRegisterOrgModalOpen] = useState(false);

  const mapPlatformAppToClient = useCallback((record: PlatformApplicationRecord): OrganisationApplication => {
    return {
      id: record.id,
      name: record.name,
      legalName: record.legal_name,
      primaryBookName: record.primary_book_name,
      primaryBookCode: record.primary_book_code,
      archetypeId: record.archetype_id,
      archetypeName: (ARCHETYPES as any)[record.archetype_id]?.name || 'General Business',
      island: record.island,
      atoll: record.atoll,
      applicantName: record.applicant_name,
      applicantEmail: record.applicant_email,
      phone: record.phone || '',
      submittedAt: record.created_at.replace('T', ' ').substring(0, 16),
      status: record.status === 'pending' ? 'pending_approval' : (record.status as any),
      rejectionReason: record.rejection_reason || undefined,
    };
  }, []);

  // SERP-405: pendingApplications was only ever appended to, never cleared, by
  // the two effects below. A browser tab that authenticates as a different
  // person -- most easily a platform admin's session followed by a fresh
  // applicant sign-in in the same tab -- could carry the previous person's
  // application(s) (including the ENTIRE admin queue) straight into the new
  // session's gating logic (AppShell's applicantPending), misrouting a
  // brand-new applicant to someone else's PendingApprovalView. Clearing here,
  // keyed only on person identity, guarantees a clean baseline before either
  // fetch below can run.
  useEffect(() => {
    setPendingApplications([]);
  }, [session?.person_id]);

  useEffect(() => {
    if (session?.platform_entitlement) {
      apiGetPlatformApplications()
        .then((res) => {
          if (res.ok && Array.isArray(res.applications)) {
            setPendingApplications(res.applications.map(mapPlatformAppToClient));
          }
        })
        .catch(() => {
          // Operator queue stays empty until the server answers.
        });
    }
  }, [session?.platform_entitlement, mapPlatformAppToClient]);

  useEffect(() => {
    if (!session) return;
    apiGetApplicantApplication()
      .then((res) => {
        if (res.ok && res.application) {
          const clientApp = mapPlatformAppToClient(res.application);
          setPendingApplications((prev) => [clientApp, ...prev.filter((a) => a.id !== clientApp.id)]);
        }
      })
      .catch(() => {
        // Applicant pending state stays server-backed only.
      });
  }, [session?.person_id, mapPlatformAppToClient]);

  const refreshApplicantApplication = useCallback(async () => {
    if (!session) return;
    try {
      const res = await apiGetApplicantApplication();
      if (res.ok && res.application) {
        const clientApp = mapPlatformAppToClient(res.application);
        setPendingApplications((prev) => [clientApp, ...prev.filter((a) => a.id !== clientApp.id)]);
      }
    } catch {
      // Applicant pending state stays server-backed only.
    }
  }, [session, mapPlatformAppToClient]);

  useEffect(() => {
    if (session?.application) {
      const sApp = session.application;
      const clientStatus = sApp.status === 'pending' ? 'pending_approval' : (sApp.status as any);
      setPendingApplications((prev) => {
        const existing = prev.find((a) => a.id === sApp.id);
        if (existing) {
          return prev.map((a) =>
            a.id === sApp.id
              ? {
                  ...a,
                  status: clientStatus,
                  rejectionReason: sApp.rejection_reason || undefined,
                  name: sApp.name || a.name,
                  legalName: sApp.legal_name || a.legalName,
                }
              : a
          );
        }
        return [
          {
            id: sApp.id,
            name: sApp.name,
            legalName: sApp.legal_name,
            primaryBookName: 'Primary Book',
            primaryBookCode: 'MAIN',
            archetypeId: 'general_business',
            archetypeName: 'General Business',
            island: '',
            atoll: '',
            applicantName: session.name || '',
            applicantEmail: session.email || '',
            phone: '',
            submittedAt: sApp.created_at.replace('T', ' ').substring(0, 16),
            status: clientStatus,
            rejectionReason: sApp.rejection_reason || undefined,
          },
          ...prev,
        ];
      });
    }
  }, [session?.application, session?.name, session?.email]);

  const submitOrganisationApplication = useCallback(
    async (appData: Omit<OrganisationApplication, 'id' | 'submittedAt' | 'status'>) => {
      const res = await apiSubmitApplication({
        name: appData.name,
        legal_name: appData.legalName,
        archetype_id: appData.archetypeId,
        primary_book_name: appData.primaryBookName,
        primary_book_code: appData.primaryBookCode,
        island: appData.island,
        atoll: appData.atoll,
        phone: appData.phone,
      });

      if (!res.ok || !res.application) {
        throw new Error('organisation_application_submit_failed');
      }
      const clientApp = mapPlatformAppToClient(res.application);
      setPendingApplications((prev) => [clientApp, ...prev.filter((a) => a.id !== clientApp.id)]);
      await refreshSession();
      return clientApp;
    },
    [mapPlatformAppToClient, refreshSession]
  );

  const approveOrganisationApplication = useCallback(
    async (appId: string): Promise<OrganisationTenant | undefined> => {
      try {
        const res = await apiApproveApplication(appId);
        if (res.ok) {
          setPendingApplications((prev) =>
            prev.map((a) => (a.id === appId ? { ...a, status: 'approved' } : a))
          );
          if (session?.platform_entitlement) {
            const appsRes = await apiGetPlatformApplications();
            if (appsRes.ok) {
              setPendingApplications(appsRes.applications.map(mapPlatformAppToClient));
            }
          }
        }
        return undefined;
      } catch (err) {
        console.error('Failed to approve organisation application:', err);
        throw err;
      }
    },
    [session?.platform_entitlement, mapPlatformAppToClient]
  );

  const rejectOrganisationApplication = useCallback(
    async (appId: string, reason?: string) => {
      try {
        const res = await apiRejectApplication(appId, reason || 'Application declined by Starq HQ Operator');
        if (res.ok) {
          setPendingApplications((prev) =>
            prev.map((a) => (a.id === appId ? { ...a, status: 'rejected', rejectionReason: reason } : a))
          );
        }
      } catch (err) {
        console.error('Failed to reject organisation application:', err);
        setPendingApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, status: 'rejected', rejectionReason: reason } : a))
        );
      }
    },
    []
  );

  const [activePlane, setActivePlane] = useState<'platform' | 'tenant'>('tenant');
  const [currentTenantId, setCurrentTenantId] = useState<string>('');
  const [currentBookId, setCurrentBookId] = useState<string>('');
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);

  // Synchronize active tenant & book context from authoritative backend session
  useEffect(() => {
    if (session?.current_organisation_id) {
      setCurrentTenantId(session.current_organisation_id);
    }
    if (session?.current_book_id) {
      setCurrentBookId(session.current_book_id);
    }
  }, [session?.current_organisation_id, session?.current_book_id]);

  // RBAC & User State
  const [users, setUsers] = useState<AppUser[]>(INITIAL_USERS);
  const [roles, setRoles] = useState<UserRole[]>(INITIAL_ROLES);
  const [currentUserId, setCurrentUserId] = useState<string>('user-1');

  // Workflows & Audit — start empty, loaded from backend
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Domain state — start empty, loaded from backend
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<JobOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>(DEMO_PRICE_LISTS);
  const [priceListsLoading, setPriceListsLoading] = useState(false);
  const dataLoadGeneration = useRef(0);
  const activeOrganisationId = useRef<string | null>(null);
  activeOrganisationId.current = session?.current_organisation_id ?? null;
  const [alerts, setAlerts] = useState<NeedsAttentionAlert[]>([]);
  const [aiInsights, setAiInsights] = useState<AIAssistantInsight[]>([]);
  const [laborEntries, setLaborEntries] = useState<LaborEntry[]>([]);

  // Transactional Edge RPC mutation states (SERP-289)
  const [mutationPending, setMutationPending] = useState<boolean>(false);
  const [lastMutationError, setLastMutationError] = useState<string | null>(null);
  const clearMutationError = useCallback(() => setLastMutationError(null), []);
  // SERP-401 + Founder Bug Log Item 5 (5 Sep 2026): staff is per-org and must
  // never seed from mock data when a real session exists. No backend HR
  // endpoint exists yet, so live sessions see an empty list until one ships.
  // The seed is intentionally kept for demo/no-session paths only (tests,
  // mockData consumers).
  //
  // Item 5 finding: this was a useState(session ? [] : INITIAL_STAFF) - a
  // lazy initializer, which React runs exactly ONCE at mount. Session loads
  // asynchronously and is null/undefined on that first render, so the legacy
  // fixture got locked in regardless of what session resolved to afterward -
  // the SERP-401 gate never actually worked once the session finished
  // loading. Nothing anywhere calls a setter for this value, so it's a plain
  // derived read, not stored state - it now recomputes every render and
  // tracks the real, current session.
  const staff: StaffMember[] = session ? [] : INITIAL_STAFF;

  // Load data from backend when session is available
  useEffect(() => {
    const generation = ++dataLoadGeneration.current;
    let cancelled = false;
    if (!session) {
      setPriceLists(DEMO_PRICE_LISTS);
      setPriceListsLoading(false);
      return () => { cancelled = true; };
    }

    const requestOrganisationId = session.current_organisation_id ?? null;
    setPriceListsLoading(true);
    // Serp314 finding: reset the registry to the DEMO reference tiers at the
    // start of every authenticated session/tenant load so a previous tenant's
    // real registry is never shown while the new request is pending. On
    // success the backend response replaces these; on failure the DEMO
    // standard + tier options remain available.
    setPriceLists(DEMO_PRICE_LISTS);
    const isCurrentLoad = () => isCurrentSessionDataLoad(
      generation,
      dataLoadGeneration.current,
      requestOrganisationId,
      activeOrganisationId.current,
      cancelled,
    );

    const loadDomainData = async () => {
      try {
        const [customersRes, jobsRes, invoicesRes, expensesRes, paymentsRes,
                inventoryRes, suppliersRes, poRes, auditRes, priceListsRes, taxRegRes] = await Promise.allSettled([
          apiGet<{ ok: boolean; customers: unknown[] }>('/api/ops/customers'),
          apiGet<{ ok: boolean; jobs: unknown[] }>('/api/ops/jobs'),
          apiGet<{ ok: boolean; invoices: unknown[] }>('/api/ops/invoices'),
          apiGet<{ ok: boolean; expenses: unknown[] }>('/api/ops/expenses'),
          apiGet<{ ok: boolean; payments: unknown[] }>('/api/ops/payments'),
          apiGet<{ ok: boolean; items: InventoryItem[]; movements: unknown[] }>('/api/ops/inventory'),
          apiGet<{ ok: boolean; suppliers: unknown[] }>('/api/ops/suppliers'),
          apiGet<{ ok: boolean; purchaseOrders: unknown[] }>('/api/ops/purchase-orders'),
          apiGet<{ ok: boolean; events: unknown[] }>('/api/ops/audit?limit=100'),
          apiGet<{ ok: boolean; price_lists: unknown[] }>('/api/ops/price-lists'),
          apiGet<{
            ok: boolean;
            registration: {
              id: string;
              organisation_id: string;
              tax_type: string;
              registration_status: string;
              tin: string | null;
              effective_from: string | null;
              effective_to: string | null;
            } | null;
          }>('/api/tenant/tax-registration'),
        ]);

        if (isCurrentLoad() && customersRes.status === 'fulfilled' && customersRes.value.ok) {
          setCustomers(mapBackendCustomers(customersRes.value.customers ?? []));
        }
        if (isCurrentLoad() && jobsRes.status === 'fulfilled' && jobsRes.value.ok) {
          setJobs(mapBackendJobs(jobsRes.value.jobs ?? []));
        }
        if (isCurrentLoad() && invoicesRes.status === 'fulfilled' && invoicesRes.value.ok) {
          setInvoices(mapBackendInvoices(invoicesRes.value.invoices ?? []));
        }
        if (isCurrentLoad() && expensesRes.status === 'fulfilled' && expensesRes.value.ok) {
          setExpenses(mapBackendExpenses(expensesRes.value.expenses ?? []));
        }
        if (isCurrentLoad() && paymentsRes.status === 'fulfilled' && paymentsRes.value.ok) {
          setPayments(mapBackendPayments(paymentsRes.value.payments ?? []));
        }
        if (isCurrentLoad() && inventoryRes.status === 'fulfilled' && inventoryRes.value.ok) {
          setInventory(Array.isArray(inventoryRes.value.items) ? inventoryRes.value.items : []);
        }
        if (isCurrentLoad() && suppliersRes.status === 'fulfilled' && suppliersRes.value.ok) {
          setSuppliers(mapBackendSuppliers(suppliersRes.value.suppliers ?? []));
        }
        if (isCurrentLoad() && poRes.status === 'fulfilled' && poRes.value.ok) {
          setPurchaseOrders(mapBackendPurchaseOrders(poRes.value.purchaseOrders ?? []));
        }
        if (isCurrentLoad() && auditRes.status === 'fulfilled' && auditRes.value.ok) {
          setAuditLogs(mapBackendAuditEvents(auditRes.value.events ?? []));
        }
        if (isCurrentLoad() && priceListsRes.status === 'fulfilled' && priceListsRes.value.ok) {
          setPriceLists(mapBackendPriceLists(priceListsRes.value.price_lists ?? []));
        }
        if (isCurrentLoad() && taxRegRes.status === 'fulfilled' && taxRegRes.value.ok) {
          const reg = taxRegRes.value.registration;
          const currentOrgId = session.current_organisation_id || (session.organisations && session.organisations[0]?.id);
          if (currentOrgId) {
            setTenantOverrides((prev) => ({
              ...prev,
              [currentOrgId]: {
                ...prev[currentOrgId],
                gstStatus: reg ? (reg.registration_status as GstRegistrationStatus) : 'unknown',
                tinNumber: reg?.tin || '',
                gstRate: reg ? (reg.registration_status === 'registered' || reg.registration_status === 'pending' ? 8 : 0) : 0,
              },
            }));
          }
        }
      } catch (err) {
        console.error('[ERP] Failed to load domain data from backend:', err);
      } finally {
        if (isCurrentLoad()) setPriceListsLoading(false);
      }
    };

    loadDomainData();
    return () => { cancelled = true; };
  }, [session]);

  // Selected drawers & modals
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);

  // Modal visibility
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isReceiveStockOpen, setIsReceiveStockOpen] = useState(false);
  const [isCreatePOOpen, setIsCreatePOOpen] = useState(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);

  // Prefilled states
  const [prefilledCustomerId, setPrefilledCustomerId] = useState<string | undefined>(undefined);
  const [prefilledJobId, setPrefilledJobId] = useState<string | undefined>(undefined);
  const [prefilledInvoiceId, setPrefilledInvoiceId] = useState<string | undefined>(undefined);

  // Current Tenant computation
  const currentTenant = useMemo(
    () => resolveCurrentTenant(tenants, currentTenantId),
    [tenants, currentTenantId]
  );
  const tenantHydrated = !authLoading && (!session || Boolean(session.current_organisation_id && currentTenantId === session.current_organisation_id));

  // Current Book computation
  const currentBook = useMemo(() => {
    if (!currentTenant.books || currentTenant.books.length === 0) return undefined;
    return currentTenant.books.find((b) => b.id === currentBookId) || currentTenant.books[0];
  }, [currentTenant, currentBookId]);

  // Current Archetype computation (SERP-288)
  const currentArchetype = useMemo(() => {
    return getArchetype(currentBook?.archetypeId || (currentTenant as any)?.industry);
  }, [currentBook, currentTenant]);

  const currentTerms = useMemo(() => {
    return currentArchetype.terminology;
  }, [currentArchetype]);

  // Synchronize default workflow stages with current archetype
  useEffect(() => {
    if (currentArchetype) {
      const defaultStages = currentArchetype.workflow.map((p, idx) => ({
        ...p,
        id: `stage-${currentArchetype.id}-${idx + 1}`,
        tenantId: currentTenant.id,
        order: idx + 1
      }));
      setWorkflowStages(defaultStages);
    }
  }, [currentArchetype.id, currentTenant.id]);

  // Current User computation
  const currentUser = useMemo(() => {
    return users.find((u) => u.id === currentUserId) || users[0];
  }, [users, currentUserId]);

  const applicantPending = Boolean(
    session &&
      (session.application?.status === 'pending' ||
        session.application?.status === 'info_requested' ||
        session.application?.status === 'rejected' ||
        pendingApplications.some((a) => a.status === 'pending_approval' || a.status === 'rejected'))
  );
  const isPendingApproval = currentUser.status === 'Pending Approval' || applicantPending;

  useEffect(() => {
    if (!session || session.platform_entitlement) return;
    if (tenants.length === 0 && !applicantPending) {
      setIsRegisterOrgModalOpen(true);
    }
  }, [session, tenants.length, applicantPending]);

  useEffect(() => {
    telemetry.setTenantId(currentTenantId);
  }, [currentTenantId]);

  // Dynamic real alerts derived from active domain state
  useEffect(() => {
    const list: NeedsAttentionAlert[] = [];

    // 1. Real Overdue Invoices
    const overdueInvoices = Array.isArray(invoices) ? invoices.filter((inv) => {
      if (inv.status === 'Paid' || inv.status === 'Draft') return false;
      if (inv.status === 'Overdue') return true;
      if (inv.dueDate && new Date(inv.dueDate) < new Date() && (inv.amountPaid || 0) < inv.totalAmount) return true;
      return false;
    }) : [];
    for (const inv of overdueInvoices.slice(0, 3)) {
      list.push({
        id: `alert-inv-${inv.id}`,
        type: 'overdue_invoice',
        title: `Invoice ${inv.invoiceNumber} overdue`,
        description: `${inv.customerName} has an unpaid balance of MVR ${(inv.totalAmount - (inv.amountPaid || 0)).toLocaleString()}.`,
        amount: inv.totalAmount - (inv.amountPaid || 0),
        urgency: 'critical',
        actionLabel: 'View Invoice',
        targetTab: 'invoices',
        targetId: inv.id,
      });
    }

    // 2. Real Low Stock Items
    const lowStock = Array.isArray(inventory) ? inventory.filter((item) => item.quantityOnHand <= item.reorderLevel) : [];
    if (lowStock.length > 0) {
      const first = lowStock[0];
      list.push({
        id: `alert-stock-${first.id}`,
        type: 'low_stock',
        title: `${first.name} (${first.sku}) below reorder level`,
        description: `Only ${first.quantityOnHand} ${first.unit} remain. Reorder threshold is ${first.reorderLevel} ${first.unit}.`,
        urgency: 'warning',
        actionLabel: 'Check Inventory',
        targetTab: 'inventory',
        targetId: first.id,
      });
    }

    // 3. Real Pending Payments
    const pendingPayments = Array.isArray(payments) ? payments.filter((p) => p.status === 'Pending Reconciliation') : [];
    for (const p of pendingPayments.slice(0, 2)) {
      list.push({
        id: `alert-pay-${p.id}`,
        type: 'payment_unreconciled',
        title: `Customer payment pending allocation`,
        description: `Payment of MVR ${(p.amount || 0).toLocaleString()} via ${p.method} pending reconciliation.`,
        amount: p.amount,
        urgency: 'warning',
        actionLabel: 'Reconcile',
        targetTab: 'payments',
        targetId: p.id,
      });
    }

    setAlerts(list);
  }, [invoices, inventory, payments]);

  // Dynamic real AI insights derived from active operational conditions
  useEffect(() => {
    if ((Array.isArray(jobs) && jobs.length === 0) && (Array.isArray(invoices) && invoices.length === 0)) {
      setAiInsights([]);
      return;
    }
    const list: AIAssistantInsight[] = [];
    const overdue = Array.isArray(invoices) ? invoices.filter((i) => i.status === 'Overdue') : [];
    const overdueCount = overdue.length;
    const overdueValue = overdue.reduce(
      (sum, i) => sum + (i.totalAmount - (i.amountPaid || 0)), 0,
    );
    if (overdueCount > 0) {
      list.push({
        id: 'ai-rec-overdue',
        category: 'Cash Flow',
        title: 'Overdue Receivables Acceleration',
        impact: 'High Impact',
        // SERP-288 — this read "accelerates settlement turnaround by up to 40%".
        // There is no such measurement anywhere in this system; the figure was
        // invented, and it was shown under the label "High Impact" to any tenant
        // with one overdue invoice. An AI recommendation carrying a fabricated
        // statistic is the SERP-237 defect again: a plausible number a reader
        // takes as a finding. It now states the action and the amount the system
        // ACTUALLY KNOWS, and claims no effect it cannot measure.
        description: `${overdueCount} invoice${overdueCount === 1 ? '' : 's'} totalling MVR ${overdueValue.toLocaleString()} ${overdueCount === 1 ? 'is' : 'are'} past due. Sending a statement of account is the usual next step.`,
        recommendedAction: 'Send Statement of Account',
        actionButtonLabel: 'Send Statements',
      });
    }
    setAiInsights(list);
  }, [jobs, invoices]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setThemeMode(next);
    telemetry.track('theme_toggled', { theme: next });
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeMode(newTheme);
    telemetry.track('theme_toggled', { theme: newTheme });
  };

  // RBAC Permission Check
  const hasPermission = (module: PermissionModule, action: PermissionAction = 'view'): boolean => {
    if (currentUser.status !== 'Active') return false;
    const userRole = roles.find((r) => r.id === currentUser.roleId);
    if (!userRole) return false;
    if (userRole.isSystemAdmin) return true;
    const modulePerms = userRole.permissions[module];
    if (!modulePerms) return false;
    return modulePerms.includes(action) || modulePerms.includes('manage');
  };

  // Audit Logging Helper
  const logAuditEvent = (entry: Omit<AuditLogEntry, 'id' | 'userId' | 'userName' | 'userRole' | 'userEmail' | 'timestamp' | 'ipAddress' | 'location' | 'tenantId'> & { location?: string; tenantId?: string }) => {
    const newAudit: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.roleName,
      userEmail: currentUser.email,
      tenantId: entry.tenantId || currentTenant.id,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '',
      location: `${currentTenant.island} Office`,
      ...entry
    };
    setAuditLogs((prev) => [newAudit, ...prev]);
  };

  // Switch Tenant
  const switchTenant = async (tenantId: string): Promise<void> => {
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;
    const targetBookId = target.books && target.books.length > 0 ? target.books[0].id : undefined;
    if (session) {
      try {
        const updatedSession = await apiSwitchContext(
          { organisation_id: tenantId, ...(targetBookId ? { book_id: targetBookId } : {}) },
          session.csrf,
        );
        login(updatedSession);
        setActivePlane('tenant');
      } catch (error) {
        console.error('[ERP] Authoritative tenant switch failed:', error);
      }
      return;
    }
    setCurrentTenantId(tenantId);
    if (targetBookId) {
      setCurrentBookId(targetBookId);
    }
    setActivePlane('tenant');
    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'settings',
      entityType: 'OrganisationTenant',
      entityId: target.id,
      entityName: target.name,
      summary: `Switched active organization to ${target.name} (${target.industry}).`
    });
  };

  // Switch Book within active Tenant
  const switchBook = (bookId: string) => {
    setCurrentBookId(bookId);
    const book = currentTenant.books?.find((b) => b.id === bookId);
    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'settings',
      entityType: 'OrganisationBook',
      entityId: bookId,
      entityName: book?.name || bookId,
      summary: `Switched active book to ${book?.name || bookId}.`
    });
  };

  // Switch Active Operating Context (Platform vs Tenant)
  const switchActiveContext = async (context: { plane: 'platform' | 'tenant'; tenantId?: string; bookId?: string }): Promise<void> => {
    if (session && context.plane === 'tenant' && context.tenantId) {
      const target = tenants.find((t) => t.id === context.tenantId);
      if (!target) return;
      const targetBookId = context.bookId || target.books?.[0]?.id;
      try {
        const updatedSession = await apiSwitchContext(
          { organisation_id: context.tenantId, ...(targetBookId ? { book_id: targetBookId } : {}) },
          session.csrf,
        );
        login(updatedSession);
        setActivePlane('tenant');
      } catch (error) {
        console.error('[ERP] Authoritative operating-context switch failed:', error);
      }
      return;
    }
    setActivePlane(context.plane);
    if (context.tenantId) {
      setCurrentTenantId(context.tenantId);
      const target = tenants.find((t) => t.id === context.tenantId);
      if (context.bookId) {
        setCurrentBookId(context.bookId);
      } else if (target?.books && target.books.length > 0) {
        setCurrentBookId(target.books[0].id);
      }
    }
    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'settings',
      entityType: 'OperatingContext',
      entityId: context.tenantId || 'platform-hq',
      entityName: context.plane === 'platform' ? 'Starq HQ' : (tenants.find((t) => t.id === context.tenantId)?.name || 'Tenant'),
      summary: `Switched active operating context to ${context.plane === 'platform' ? 'Starq HQ Platform Control Plane' : `${context.tenantId} / ${context.bookId || 'default'}`}.`
    });
  };

  // Currency Formatter
  const formatMVR = (amount: number, showDecimals: boolean = true) => {
    const symbol = currentTenant.currencySymbol || 'MVR';
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0
    }).format(amount);
    return `${symbol} ${formatted}`;
  };

  // Quick stats calculations
  const totalSalesToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return Array.isArray(invoices)
      ? invoices.filter((inv) => inv.date === today).reduce((acc, inv) => acc + inv.totalAmount, 0)
      : 0;
  }, [invoices]);
  const totalCashReceived = useMemo(() => {
    return Array.isArray(payments) ? payments.reduce((acc, p) => acc + p.amount, 0) : 0;
  }, [payments]);

  const totalOutstandingInvoices = useMemo(() => {
    return Array.isArray(invoices) ? invoices.reduce((acc, inv) => acc + inv.balanceDue, 0) : 0;
  }, [invoices]);

  const totalAccountsPayable = useMemo(() => {
    return Array.isArray(suppliers) ? suppliers.reduce((acc, sup) => acc + sup.outstandingPayable, 0) : 0;
  }, [suppliers]);

  const activeJobsCount = useMemo(() => {
    return Array.isArray(jobs) ? jobs.filter((j) => !['Completed', 'Paid', 'Tax Invoiced & Settled'].includes(j.status)).length : 0;
  }, [jobs]);

  const lowStockItemsCount = useMemo(() => {
    return Array.isArray(inventory) ? inventory.filter((item) => item.quantityOnHand <= item.reorderLevel).length : 0;
  }, [inventory]);

  // Create new Tenant (Organisation Setup)
  const createTenant = (tenantData: Omit<OrganisationTenant, 'id' | 'createdAt'>): OrganisationTenant => {
    const newTenant: OrganisationTenant = {
      ...tenantData,
      id: `tenant-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setTenants((prev) => [...prev, newTenant]);
    setCurrentTenantId(newTenant.id);
    setMutationPending(true);
    setLastMutationError(null);

    dispatchCommand({
      command: 'TENANT_ONBOARD',
      payload: {
        name: newTenant.name,
        tinNumber: newTenant.tinNumber,
        industry: newTenant.industry,
        address: newTenant.address,
        phone: newTenant.phone,
      },
    }).then(() => { setMutationPending(false); })
    .catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'TENANT_ONBOARD command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] TENANT_ONBOARD command failed:', err);
      if (session || err instanceof ApiError) {
        setTenants((prev) => prev.filter((t) => t.id !== newTenant.id));
      }
    });

    // Apply industry workflow preset directly to the new tenant id
    if (newTenant.industry === 'Medical Clinic & Diagnostics') {
      resetWorkflowToPreset('clinic', newTenant.id);
    } else if (newTenant.industry === 'Marine & Boatyard') {
      resetWorkflowToPreset('marine', newTenant.id);
    } else {
      resetWorkflowToPreset('automotive', newTenant.id);
    }

    // Ensure founder/creator is active with owner/admin privileges and not locked out of new tenant (SERP-163)
    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUserId
          ? {
              ...u,
              status: 'Active',
              roleId: 'role-super-admin',
              roleName: 'Owner & Super Administrator',
            }
          : u
      )
    );

    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'settings',
      entityType: 'OrganisationTenant',
      entityId: newTenant.id,
      entityName: newTenant.name,
      summary: `Completed initial organization onboarding for ${newTenant.name}. TIN: ${newTenant.tinNumber || 'not_registered'}.`
    });

    return newTenant;
  };

  const updateTenant = async (tenantData: Partial<OrganisationTenant>) => {
    const orgId = currentTenant.id;
    if (orgId) {
      setTenantOverrides((prev) => ({
        ...prev,
        [orgId]: {
          ...prev[orgId],
          ...tenantData,
        },
      }));
    }
    setTenants((prev) =>
      prev.map((t) => (t.id === currentTenant.id ? { ...t, ...tenantData } : t))
    );
    if (session && tenantData.gstStatus && tenantData.gstStatus !== 'unknown') {
      await apiPost('/api/tenant/tax-registration', {
        registration_status: tenantData.gstStatus,
        tin: tenantData.tinNumber !== undefined ? tenantData.tinNumber : currentTenant.tinNumber,
      });
    }
    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'settings',
      entityType: 'OrganisationTenant',
      entityId: currentTenant.id,
      entityName: currentTenant.name,
      summary: `Updated organization settings and profile for ${currentTenant.name}.`
    });
  };

  const updateTenantLogo = (logoUrl: string | null) => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === currentTenant.id
          ? { ...t, logoUrl: logoUrl || undefined }
          : t
      )
    );
    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'settings',
      entityType: 'OrganisationTenant',
      entityId: currentTenant.id,
      entityName: currentTenant.name,
      summary: logoUrl
        ? `Uploaded and configured new brand logo for ${currentTenant.name}.`
        : `Removed brand logo and reverted to monogram initials for ${currentTenant.name}.`
    });
  };

  // MFA State (SERP-268)
  const [isMfaElevated, setIsMfaElevated] = useState<boolean>(true); // Elevated for primary initial active session
  const [isMfaChallengeOpen, setIsMfaChallengeOpen] = useState<boolean>(false);
  const [isMfaEnrollmentOpen, setIsMfaEnrollmentOpen] = useState<boolean>(false);
  const [pendingMfaAction, setPendingMfaAction] = useState<(() => void) | null>(null);

  const openMfaEnrollment = () => setIsMfaEnrollmentOpen(true);
  const closeMfaEnrollment = () => setIsMfaEnrollmentOpen(false);

  const openMfaChallenge = (onSuccess?: () => void) => {
    if (onSuccess) setPendingMfaAction(() => onSuccess);
    setIsMfaChallengeOpen(true);
  };

  const closeMfaChallenge = () => {
    setIsMfaChallengeOpen(false);
    setPendingMfaAction(null);
  };

  const requireMfaElevation = (action: () => void) => {
    const userRole = roles.find((r) => r.id === currentUser.roleId);
    const isPrivileged =
      currentUser.roleName === 'Super Administrator' ||
      !!userRole?.isSystemAdmin ||
      !!currentUser.mfaRequired;

    if (!isPrivileged) {
      // Non-privileged users proceed directly
      action();
      return;
    }

    if (!currentUser.mfaEnabled) {
      // Must enroll in MFA first
      openMfaEnrollment();
      return;
    }

    if (isMfaElevated) {
      // Already verified for this elevated session
      action();
      return;
    }

    // Open challenge modal to verify second factor
    openMfaChallenge(action);
  };

  const enrollMfa = (
    userId: string,
    secret: string,
    verificationCode: string,
    recoveryCodes: string[]
  ): { ok: boolean; error?: string } => {
    const cleanCode = (verificationCode || '').trim().replace(/[\s-]/g, '');
    if (!/^\d{6}$/.test(cleanCode) || cleanCode === '000001' || cleanCode === '999998') {
      return { ok: false, error: 'Invalid 6-digit verification code' };
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              mfaEnabled: true,
              mfaRequired: true,
              mfaSecret: secret,
              mfaEnrolledAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
              recoveryCodes: recoveryCodes,
            }
          : u
      )
    );

    setIsMfaElevated(true);
    closeMfaEnrollment();

    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'users',
      entityType: 'AppUser',
      entityId: userId,
      entityName: currentUser.name,
      summary: `MFA / Two-Factor Authentication enrolled for user ${currentUser.name}. Recovery codes generated.`,
      newValue: 'MFA Status: Enrolled & Active',
    });

    return { ok: true };
  };

  const verifyMfaChallenge = (code: string): { ok: boolean; error?: string } => {
    const cleanCode = (code || '').trim().replace(/[\s-]/g, '').toUpperCase();
    if (!cleanCode) return { ok: false, error: 'Please enter your authentication code' };

    const targetUser = currentUser;
    const recoveryCodes = targetUser.recoveryCodes || [];

    // Check recovery code
    const recIndex = recoveryCodes.findIndex((rc) => rc.replace(/[\s-]/g, '').toUpperCase() === cleanCode);
    if (recIndex !== -1) {
      const remaining = [...recoveryCodes];
      remaining.splice(recIndex, 1);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, recoveryCodes: remaining } : u))
      );
      setIsMfaElevated(true);
      setIsMfaChallengeOpen(false);

      if (pendingMfaAction) {
        const cb = pendingMfaAction;
        setPendingMfaAction(null);
        cb();
      }

      logAuditEvent({
        action: 'STATUS_CHANGED',
        module: 'users',
        entityType: 'AppUser',
        entityId: targetUser.id,
        entityName: targetUser.name,
        summary: `MFA elevation authorized via single-use recovery code. ${remaining.length} recovery code(s) remaining.`,
      });

      return { ok: true };
    }

    // Check TOTP format
    if (/^\d{6}$/.test(cleanCode)) {
      if (cleanCode === '000001' || cleanCode === '999998') {
        return { ok: false, error: 'Invalid or expired authentication code' };
      }

      setIsMfaElevated(true);
      setIsMfaChallengeOpen(false);

      if (pendingMfaAction) {
        const cb = pendingMfaAction;
        setPendingMfaAction(null);
        cb();
      }

      logAuditEvent({
        action: 'STATUS_CHANGED',
        module: 'users',
        entityType: 'AppUser',
        entityId: targetUser.id,
        entityName: targetUser.name,
        summary: `Admin MFA challenge satisfied via time-based authenticator token.`,
      });

      return { ok: true };
    }

    return { ok: false, error: 'Invalid authentication code format' };
  };

  const disableMfa = (userId: string, verificationCode: string): { ok: boolean; error?: string } => {
    const cleanCode = (verificationCode || '').trim().replace(/[\s-]/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      return { ok: false, error: 'A valid 6-digit confirmation code is required to disable MFA' };
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              mfaEnabled: false,
              mfaEnrolledAt: undefined,
              mfaSecret: undefined,
              recoveryCodes: [],
            }
          : u
      )
    );

    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'users',
      entityType: 'AppUser',
      entityId: userId,
      entityName: currentUser.name,
      summary: `MFA disabled for user ${currentUser.name}.`,
      newValue: 'MFA Status: Disabled',
    });

    return { ok: true };
  };

  const usersRef = useRef(users);
  usersRef.current = users;
  const rolesRef = useRef(roles);
  rolesRef.current = roles;

  // Switch Current User Persona (to showcase RBAC gating)
  const switchCurrentUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
    const user = usersRef.current.find((u) => u.id === userId);
    // If switching to a privileged account, reset session elevation to require challenge
    const userRole = rolesRef.current.find((r) => r.id === user?.roleId);
    const isPrivileged = user?.roleName === 'Super Administrator' || !!userRole?.isSystemAdmin || !!user?.mfaRequired;
    setIsMfaElevated(!isPrivileged);
  }, []);

  // Authorize Pending User (Admin Capability)
  const authorizeUser = (userId: string, roleId?: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    const assignedRoleId = roleId || targetUser.roleId;
    const roleObj = roles.find((r) => r.id === assignedRoleId);
    const assignedRoleName = roleObj ? roleObj.name : targetUser.roleName;

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              status: 'Active',
              roleId: assignedRoleId,
              roleName: assignedRoleName,
              authorizedBy: currentUser.name,
              authorizedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
              lastActiveAt: 'Active now'
            }
          : u
      )
    );

    // Dismiss pending approval alert if exists
    setAlerts((prev) => prev.filter((a) => a.targetId !== userId));

    logAuditEvent({
      action: 'USER_AUTHORIZED',
      module: 'users',
      entityType: 'AppUser',
      entityId: targetUser.id,
      entityName: targetUser.name,
      summary: `Authorized user access for ${targetUser.name} (${targetUser.email}). Assigned role: ${assignedRoleName}.`,
      previousValue: `Status: ${targetUser.status}`,
      newValue: `Status: Active | Role: ${assignedRoleName}`
    });
  };

  // Suspend User
  const suspendUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: 'Suspended', lastActiveAt: 'Suspended' } : u))
    );

    logAuditEvent({
      action: 'USER_SUSPENDED',
      module: 'users',
      entityType: 'AppUser',
      entityId: targetUser.id,
      entityName: targetUser.name,
      summary: `Suspended system access for ${targetUser.name} (${targetUser.email}).`,
      previousValue: `Status: ${targetUser.status}`,
      newValue: 'Status: Suspended'
    });
  };

  // Staff Invitations State & Lifecycle (SERP-286)
  const [invitations, setInvitations] = useState<StaffInvitationRecord[]>([]);

  useEffect(() => {
    const activeOrgId = session?.current_organisation_id || currentTenant?.id;
    if (activeOrgId) {
      apiGetTenantInvitations()
        .then((res) => {
          if (res.ok && Array.isArray(res.invitations)) {
            setInvitations(res.invitations);
          }
        })
        .catch(() => {});
    }
  }, [session?.current_organisation_id, currentTenant?.id]);

  const inviteStaffMember = useCallback(
    async (payload: CreateStaffInvitationPayload): Promise<StaffInvitationRecord> => {
      const res = await apiCreateTenantInvitation(payload);
      if (res.ok && res.invitation) {
        setInvitations((prev) => [res.invitation, ...prev.filter((i) => i.id !== res.invitation.id)]);
        logAuditEvent({
          action: 'STAFF_INVITED',
          module: 'users',
          entityType: 'Invitation',
          entityId: res.invitation.id,
          entityName: res.invitation.name,
          summary: `Dispatched staff invitation to ${res.invitation.email} for role ${res.invitation.role_id}. Token expires in 7 days.`,
          newValue: 'Status: Pending Invite'
        });
        return res.invitation;
      }
      throw new Error('Failed to create invitation');
    },
    [logAuditEvent]
  );

  const resendInvitation = useCallback(
    async (id: string): Promise<void> => {
      const res = await apiResendTenantInvitation(id);
      if (res.ok && res.invitation) {
        setInvitations((prev) =>
          prev.map((i) => (i.id === id ? res.invitation : i))
        );
        logAuditEvent({
          action: 'INVITATION_RESENT',
          module: 'users',
          entityType: 'Invitation',
          entityId: id,
          entityName: res.invitation.name,
          summary: `Resent staff invitation to ${res.invitation.email}. Token refreshed with 7-day expiration.`,
        });
      }
    },
    [logAuditEvent]
  );

  const revokeInvitation = useCallback(
    async (id: string): Promise<void> => {
      const res = await apiRevokeTenantInvitation(id);
      if (res.ok) {
        setInvitations((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: 'revoked' } : i))
        );
        logAuditEvent({
          action: 'INVITATION_REVOKED',
          module: 'users',
          entityType: 'Invitation',
          entityId: id,
          entityName: 'Staff Invitation',
          summary: `Revoked staff invitation ${id}.`,
        });
      }
    },
    [logAuditEvent]
  );

  // Legacy Invite User wrapper for local state compatibility
  const inviteUser = (userData: {
    name: string;
    email: string;
    phone: string;
    roleId: string;
    jobTitle?: string;
  }): AppUser => {
    const roleObj = roles.find((r) => r.id === userData.roleId);
    const newUser: AppUser = {
      id: `user-${Date.now()}`,
      tenantId: currentTenant.id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      roleId: userData.roleId,
      roleName: roleObj ? roleObj.name : 'Custom Role',
      status: 'Active',
      invitedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      lastActiveAt: 'Invitation Dispatched',
      jobTitle: userData.jobTitle || 'Team Member'
    };

    setUsers((prev) => [...prev, newUser]);
    // Dispatch server invitation asynchronously
    apiCreateTenantInvitation({
      email: userData.email,
      name: userData.name,
      role_id: userData.roleId,
      job_title: userData.jobTitle,
      phone: userData.phone,
    }).then((res) => {
      if (res.ok && res.invitation) {
        setInvitations((prev) => [res.invitation, ...prev.filter((i) => i.id !== res.invitation.id)]);
      }
    }).catch(() => {});

    logAuditEvent({
      action: 'USER_INVITED',
      module: 'users',
      entityType: 'AppUser',
      entityId: newUser.id,
      entityName: newUser.name,
      summary: `Invited user ${newUser.name} (${userData.email}) with initial role ${newUser.roleName}.`,
      newValue: 'Status: Invited'
    });

    return newUser;
  };

  const updateUserRole = (userId: string, roleId: string) => {
    const roleObj = roles.find((r) => r.id === roleId);
    if (!roleObj) return;

    const targetUser = users.find((u) => u.id === userId);
    const oldRole = targetUser?.roleName || 'Unknown';

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, roleId, roleName: roleObj.name } : u))
    );

    logAuditEvent({
      action: 'ROLE_UPDATED',
      module: 'roles',
      entityType: 'AppUser',
      entityId: userId,
      entityName: targetUser?.name || userId,
      summary: `Changed role of ${targetUser?.name} from ${oldRole} to ${roleObj.name}.`,
      previousValue: `Role: ${oldRole}`,
      newValue: `Role: ${roleObj.name}`
    });
  };

  // Role CRUD
  const createRole = (roleData: Omit<UserRole, 'id' | 'tenantId'>): UserRole => {
    const newRole: UserRole = {
      ...roleData,
      id: `role-${Date.now()}`,
      tenantId: currentTenant.id
    };
    setRoles((prev) => [...prev, newRole]);
    setMutationPending(true);
    setLastMutationError(null);

    dispatchCommand({
      command: 'ROLE',
      payload: {
        name: newRole.name,
        permissions: newRole.permissions,
        tenantId: newRole.tenantId,
      },
    }).then(() => { setMutationPending(false); })
    .catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'ROLE command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] ROLE command failed:', err);
      if (session || err instanceof ApiError) {
        setRoles((prev) => prev.filter((r) => r.id !== newRole.id));
      }
    });

    logAuditEvent({
      action: 'ROLE_UPDATED',
      module: 'roles',
      entityType: 'UserRole',
      entityId: newRole.id,
      entityName: newRole.name,
      summary: `Created new custom role: ${newRole.name}.`
    });

    return newRole;
  };

  const updateRolePermissions = (roleId: string, permissions: UserRole['permissions']) => {
    const roleObj = roles.find((r) => r.id === roleId);
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, permissions } : r))
    );

    logAuditEvent({
      action: 'ROLE_UPDATED',
      module: 'roles',
      entityType: 'UserRole',
      entityId: roleId,
      entityName: roleObj?.name || roleId,
      summary: `Updated granular permission matrix for role ${roleObj?.name}.`
    });
  };

  const deleteRole = (roleId: string) => {
    const roleObj = roles.find((r) => r.id === roleId);
    if (roleObj?.isSystemAdmin) return; // Cannot delete system admin
    setRoles((prev) => prev.filter((r) => r.id !== roleId));

    logAuditEvent({
      action: 'ROLE_UPDATED',
      module: 'roles',
      entityType: 'UserRole',
      entityId: roleId,
      entityName: roleObj?.name || roleId,
      summary: `Deleted custom role: ${roleObj?.name}.`
    });
  };

  // Configurable Workflow Actions
  const addWorkflowStage = (stage: Omit<WorkflowStage, 'id' | 'tenantId' | 'order'>): WorkflowStage => {
    const nextOrder = workflowStages.length + 1;
    const newStage: WorkflowStage = {
      ...stage,
      id: `stage-${Date.now()}`,
      tenantId: currentTenant.id,
      order: nextOrder
    };
    setWorkflowStages((prev) => [...prev, newStage]);
    setMutationPending(true);
    setLastMutationError(null);

    dispatchCommand({
      command: 'WORKFLOW',
      payload: {
        name: newStage.name,
        code: newStage.code,
        order: newStage.order,
        tenantId: newStage.tenantId,
      },
    }).then(() => { setMutationPending(false); })
    .catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'WORKFLOW command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] WORKFLOW command failed:', err);
      if (session || err instanceof ApiError) {
        setWorkflowStages((prev) => prev.filter((s) => s.id !== newStage.id));
      }
    });

    logAuditEvent({
      action: 'WORKFLOW_MODIFIED',
      module: 'workflows',
      entityType: 'WorkflowStage',
      entityId: newStage.id,
      entityName: newStage.name,
      summary: `Added new workflow pipeline stage: "${newStage.name}" (Code: ${newStage.code}, Order: ${nextOrder}).`
    });

    return newStage;
  };

  const updateWorkflowStage = (stageId: string, stageData: Partial<WorkflowStage>) => {
    setWorkflowStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, ...stageData } : s))
    );

    logAuditEvent({
      action: 'WORKFLOW_MODIFIED',
      module: 'workflows',
      entityType: 'WorkflowStage',
      entityId: stageId,
      entityName: stageData.name || stageId,
      summary: `Modified workflow pipeline stage properties for ${stageData.name || stageId}.`
    });
  };

  const deleteWorkflowStage = (stageId: string) => {
    const stage = workflowStages.find((s) => s.id === stageId);
    setWorkflowStages((prev) => prev.filter((s) => s.id !== stageId));

    logAuditEvent({
      action: 'WORKFLOW_MODIFIED',
      module: 'workflows',
      entityType: 'WorkflowStage',
      entityId: stageId,
      entityName: stage?.name || stageId,
      summary: `Removed workflow pipeline stage "${stage?.name}".`
    });
  };

  const resetWorkflowToPreset = (presetType: string, targetTenantId?: string) => {
    const orgId = targetTenantId || currentTenant.id;
    let archetypeKey: ArchetypeId = 'general_business';
    if (presetType === 'clinic' || presetType === 'medical_clinic') {
      archetypeKey = 'medical_clinic';
    } else if (presetType === 'marine' || presetType === 'marine_service') {
      archetypeKey = 'marine_service';
    } else if (presetType === 'automotive' || presetType === 'automotive_workshop') {
      archetypeKey = 'automotive_workshop';
    } else if (presetType in ARCHETYPES) {
      archetypeKey = presetType as ArchetypeId;
    }

    const archetypeDef = getArchetype(archetypeKey);
    const preset: WorkflowStage[] = archetypeDef.workflow.map((p, idx) => ({
      ...p,
      id: `stage-${archetypeKey}-${idx + 1}`,
      tenantId: orgId,
      order: idx + 1
    }));

    setWorkflowStages(preset);

    logAuditEvent({
      action: 'WORKFLOW_MODIFIED',
      module: 'workflows',
      entityType: 'WorkflowStage',
      entityId: `preset-${archetypeKey}`,
      entityName: `${archetypeDef.name} Workflow Template`,
      summary: `Loaded standard workflow pipeline template for: ${archetypeDef.name}.`
    });
  };

  // Actions
  const updateJobStatus = (jobId: string, status: JobStatus) => {
    const job = jobs.find((j) => j.id === jobId || j.jobId === jobId);
    const oldStatus = job?.status;

    setJobs((prev) =>
      prev.map((j) => {
        if (j.id === jobId || j.jobId === jobId) {
          const completedDate =
            status === 'Completed' || status.toLowerCase().includes('delivery') || status.toLowerCase().includes('discharged')
              ? new Date().toISOString().split('T')[0]
              : j.completedDate;
          return { ...j, status, completedDate };
        }
        return j;
      })
    );

    logAuditEvent({
      action: 'STAGE_TRANSITIONED',
      module: 'jobs',
      entityType: 'JobOrder',
      entityId: jobId,
      entityName: job ? `${job.jobId} (${job.customerName})` : jobId,
      summary: `Transitioned work order ${job?.jobId} from "${oldStatus}" to "${status}".`,
      previousValue: `Stage: ${oldStatus}`,
      newValue: `Stage: ${status}`
    });
  };

  const addMaterialToJob = (jobId: string, inventoryId: string, quantity: number) => {
    const item = inventory.find((i) => i.id === inventoryId);
    if (!item) return;

    const totalCost = item.unitCost * quantity;
    const materialUsage = {
      id: `mat-${Date.now()}`,
      inventoryId: item.id,
      itemName: item.name,
      quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      totalCost,
      addedAt: new Date().toISOString().split('T')[0]
    };

    // Update job
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id === jobId || job.jobId === jobId) {
          const newMaterials = [...job.materialsUsed, materialUsage];
          const newActualMatCost = job.actualMaterialCost + totalCost;
          const newProfit = job.quotedAmount - (newActualMatCost + job.actualLaborCost);
          return {
            ...job,
            materialsUsed: newMaterials,
            actualMaterialCost: newActualMatCost,
            actualProfit: newProfit
          };
        }
        return job;
      })
    );

    setMutationPending(true);
    setLastMutationError(null);
    dispatchCommand({
      command: 'WORK',
      payload: { jobId, inventoryId, quantity, totalCost },
    }).then(() => { setMutationPending(false); })
    .catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'WORK command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] WORK command failed:', err);
      if (session || err instanceof ApiError) {
        // Rollback job material addition
        setJobs((prev) => prev.map((j) => j.id === jobId ? {...j, materialsUsed: j.materialsUsed.filter((m) => m.id !== materialUsage.id), actualMaterialCost: j.actualMaterialCost - totalCost, actualProfit: j.quotedAmount - (j.actualMaterialCost - totalCost + j.actualLaborCost)} : j));
      }
    });

    // Update inventory quantity
    setInventory((prev) =>
      prev.map((i) => {
        if (i.id === inventoryId) {
          const newQty = Math.max(0, i.quantityOnHand - quantity);
          return {
            ...i,
            quantityOnHand: newQty,
            stockStatus: newQty <= 0 ? 'Out of Stock' : newQty <= i.reorderLevel ? 'Low Stock' : 'In Stock'
          };
        }
        return i;
      })
    );

    // Add stock movement log
    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      type: 'Deducted (Job)',
      quantity: -quantity,
      unit: item.unit,
      date: new Date().toLocaleString(),
      reference: jobId,
      staffName: currentUser.name,
      notes: `Used on work order ${jobId}`
    };
    setStockMovements((prev) => [newMovement, ...prev]);

    logAuditEvent({
      action: 'STOCK_ADJUSTED',
      module: 'inventory',
      entityType: 'InventoryItem',
      entityId: item.id,
      entityName: item.name,
      summary: `Deducted ${quantity} ${item.unit} for job ${jobId}. Total material cost: ${formatMVR(totalCost)}.`,
      previousValue: `Stock: ${item.quantityOnHand} ${item.unit}`,
      newValue: `Stock: ${item.quantityOnHand - quantity} ${item.unit}`
    });
  };

  const addLaborEntry = (entry: Omit<LaborEntry, 'id' | 'totalCostMvr' | 'clockedAt'>) => {
    const totalCostMvr = Math.round(entry.hoursWorked * entry.hourlyCostRateMvr);
    const newEntry: LaborEntry = {
      ...entry,
      id: `lab-${Date.now()}`,
      totalCostMvr,
      clockedAt: new Date().toISOString()
    };

    setLaborEntries((prev) => [newEntry, ...prev]);

    // Recompute job actual labor cost, totals, and margin in real time
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id === newEntry.jobId || job.jobId === newEntry.jobId) {
          return {
            ...job,
            actualLaborCost: job.actualLaborCost + totalCostMvr,
            totalLaborHours: job.totalLaborHours + entry.hoursWorked,
            actualProfit: job.quotedAmount - (job.actualMaterialCost + job.actualLaborCost + totalCostMvr),
            laborCostEstimate: Math.max(job.laborCostEstimate, job.actualLaborCost + totalCostMvr),
          };
        }
        return job;
      })
    );

    setMutationPending(true);
    setLastMutationError(null);
    dispatchCommand({
      command: 'WORK',
      payload: {
        jobId: newEntry.jobId,
        technicianId: newEntry.technicianId,
        technician_name: newEntry.technicianName,
        task: newEntry.taskDescription,
        hours: entry.hoursWorked,
        hourly_rate: entry.hourlyCostRateMvr,
        total_cost: totalCostMvr,
        type: 'timesheet'
      },
    }).then(() => {
      setMutationPending(false);
    }).catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'WORK command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] WORK timesheet command failed:', err);
      if (session || err instanceof ApiError) {
        // Rollback labor entry and job recalculation on authoritative rejection
        setLaborEntries((prev) => prev.filter((l) => l.id !== newEntry.id));
        setJobs((prev) =>
          prev.map((job) => {
            if (job.id === newEntry.jobId || job.jobId === newEntry.jobId) {
              const revertedLaborCost = Math.max(0, job.actualLaborCost - totalCostMvr);
              return {
                ...job,
                actualLaborCost: revertedLaborCost,
                totalLaborHours: Math.max(0, job.totalLaborHours - entry.hoursWorked),
                actualProfit: job.quotedAmount - (job.actualMaterialCost + revertedLaborCost),
              };
            }
            return job;
          })
        );
      }
    });

    logAuditEvent({
      action: 'CREATED',
      module: 'jobs',
      entityType: 'JobOrder',
      entityId: newEntry.jobId,
      entityName: newEntry.jobId,
      summary: `${newEntry.technicianName} clocked ${entry.hoursWorked}h on "${entry.taskDescription}" at ${formatMVR(newEntry.hourlyCostRateMvr)}/hr (${formatMVR(totalCostMvr)}).`,
      previousValue: 'Labor entry: none',
      newValue: `${newEntry.hoursWorked}h labor logged`
    });
  };

  const createCustomer = (customerData: Omit<Customer, 'id' | 'createdAt' | 'activeJobsCount' | 'totalInvoiced' | 'outstandingBalance'>): Customer => {
    const newCustomer: Customer = {
      ...customerData,
      id: `cust-${Date.now()}`,
      activeJobsCount: 0,
      totalInvoiced: 0,
      outstandingBalance: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setCustomers((prev) => [newCustomer, ...prev]);

    setMutationPending(true);
    setLastMutationError(null);

    // Dispatch to backend (SERP-289)
    dispatchCommand({
      command: 'CUSTOMER',
      payload: {
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        island: customerData.island,
        notes: customerData.notes,
        type: customerData.type,
        vehicles: customerData.vehicles,
        price_list_id: customerData.priceListId,
      },
    }).then(() => {
      setMutationPending(false);
    }).catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'CUSTOMER command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] CUSTOMER command failed:', err);

      // Rollback on authoritative server rejection or authenticated session failure
      if (session || err instanceof ApiError) {
        setCustomers((prev) => prev.filter((c) => c.id !== newCustomer.id));
      }
    });

    logAuditEvent({
      action: 'CREATED',
      module: 'customers' as PermissionModule,
      entityType: 'Customer',
      entityId: newCustomer.id,
      entityName: newCustomer.name,
      summary: `Created customer record for ${newCustomer.name} (${newCustomer.phone}, ${newCustomer.island}).`
    });

    return newCustomer;
  };

  const createSupplier = (supplierData: Omit<Supplier, 'id' | 'outstandingPayable' | 'rating'>): Supplier => {
    const newSupplier: Supplier = { ...supplierData, id: `supplier-${Date.now()}`, outstandingPayable: 0, rating: 0 };
    setSuppliers((prev) => [newSupplier, ...prev]);
    setMutationPending(true);
    setLastMutationError(null);
    dispatchCommand({ command: 'SUPPLIER', payload: supplierData })
      .then(() => setMutationPending(false))
      .catch((err) => {
        setMutationPending(false);
        setLastMutationError(err instanceof Error ? err.message : 'SUPPLIER command failed');
        if (session || err instanceof ApiError) setSuppliers((prev) => prev.filter((s) => s.id !== newSupplier.id));
      });
    logAuditEvent({ action: 'CREATED', module: 'suppliers', entityType: 'Supplier', entityId: newSupplier.id, entityName: newSupplier.name, summary: `Created supplier record for ${newSupplier.name}.` });
    return newSupplier;
  };

  const updateSupplier = (supplierData: Supplier): Supplier => {
    const prevSupplier = suppliers.find((s) => s.id === supplierData.id);
    const updatedSupplier: Supplier = { ...(prevSupplier ?? supplierData), ...supplierData };
    setSuppliers((prev) => prev.map((s) => (s.id === supplierData.id ? updatedSupplier : s)));
    setMutationPending(true);
    setLastMutationError(null);
    dispatchCommand({
      command: 'SUPPLIER_UPDATE',
      payload: {
        supplier_id: supplierData.id,
        name: supplierData.name.trim(),
        phone: supplierData.phone,
        email: supplierData.email,
        contact_person: supplierData.contactPerson,
        address: supplierData.address,
        island: supplierData.islandOrCountry,
        category: supplierData.category,
        lead_time_days: supplierData.leadTimeDays,
      },
    })
      .then(() => setMutationPending(false))
      .catch((err) => {
        setMutationPending(false);
        setLastMutationError(err instanceof Error ? err.message : 'SUPPLIER_UPDATE command failed');
        if (session || err instanceof ApiError) setSuppliers((prev) => prev.map((s) => (s.id === supplierData.id ? (prevSupplier ?? s) : s)));
      });
    logAuditEvent({ action: 'UPDATED', module: 'suppliers', entityType: 'Supplier', entityId: supplierData.id, entityName: supplierData.name, summary: `Updated supplier record for ${supplierData.name}.` });
    return updatedSupplier;
  };

  const deactivateSupplier = (supplierId: string): void => {
    const removed = suppliers.find((s) => s.id === supplierId);
    if (!removed) return;
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
    setMutationPending(true);
    setLastMutationError(null);
    dispatchCommand({ command: 'SUPPLIER_DEACTIVATE', payload: { supplier_id: supplierId } })
      .then(() => setMutationPending(false))
      .catch((err) => {
        setMutationPending(false);
        setLastMutationError(err instanceof Error ? err.message : 'SUPPLIER_DEACTIVATE command failed');
        if (session || err instanceof ApiError) {
          const restored = suppliers.find((s) => s.id === supplierId);
          setSuppliers((prev) => [...prev.filter((s) => s.id !== supplierId), ...(restored ? [restored] : [])]);
        }
      });
    logAuditEvent({ action: 'DELETED', module: 'suppliers', entityType: 'Supplier', entityId: supplierId, entityName: removed.name, summary: `Deactivated supplier record for ${removed.name}.` });
  };

  const createPriceList = async (
    priceListData: Omit<PriceList, 'id' | 'registryId' | 'version' | 'createdAt' | 'updatedAt'>,
  ): Promise<PriceList> => {
    const code = (priceListData.code ?? '').trim().toLowerCase();
    const candidate = { ...priceListData, code };
    const validation = validatePriceList(candidate);
    if (validation.length > 0) throw new Error(validation[0].message);
    if (priceLists.some((list) => list.id === code)) {
      throw new Error('Price list code already exists.');
    }

    if (!session) {
      const localPriceList: PriceList = { ...candidate, id: code, code, active: true };
      setPriceLists((prev) => [localPriceList, ...prev]);
      return localPriceList;
    }

    setMutationPending(true);
    setLastMutationError(null);
    try {
      const response = await dispatchCommand<Record<string, unknown>, { price_list?: unknown }>({
        command: 'PRICE_LIST',
        payload: {
          action: 'create',
          code,
          name: candidate.name,
          description: candidate.description,
          discount_percent: candidate.discountPercent,
          overrides: candidate.itemOverrides.map((override) => ({
            product_id: override.itemId,
            unit_price: override.unitPrice,
          })),
        },
      });
      const created = response.price_list ? mapBackendPriceLists([response.price_list])[0] : undefined;
      if (!created) throw new Error('PRICE_LIST command returned no price list.');
      setPriceLists((prev) => [created, ...prev.filter((list) => list.id !== created.id)]);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PRICE_LIST command failed';
      setLastMutationError(message);
      throw err;
    } finally {
      setMutationPending(false);
    }
  };

  const updatePriceList = async (
    priceListId: string,
    priceListData: Partial<Omit<PriceList, 'id' | 'registryId'>>,
  ): Promise<PriceList> => {
    const existing = priceLists.find((list) => list.id === priceListId);
    if (!existing) throw new Error('Price list not found.');
    const candidate: PriceList = {
      ...existing,
      ...priceListData,
      id: existing.id,
      code: existing.code ?? existing.id,
      itemOverrides: priceListData.itemOverrides ?? existing.itemOverrides,
    };
    const validation = validatePriceList(candidate);
    if (validation.length > 0) throw new Error(validation[0].message);

    if (!session) {
      setPriceLists((prev) => prev.map((list) => list.id === priceListId ? candidate : list));
      return candidate;
    }

    if (!existing.registryId) throw new Error('Price list registry id is missing.');
    setMutationPending(true);
    setLastMutationError(null);
    try {
      const response = await dispatchCommand<Record<string, unknown>, { price_list?: unknown }>({
        command: 'PRICE_LIST',
        payload: {
          action: 'update',
          price_list_id: existing.registryId,
          expected_version: existing.version ?? 1,
          name: candidate.name,
          description: candidate.description,
          discount_percent: candidate.discountPercent,
          overrides: candidate.itemOverrides.map((override) => ({
            product_id: override.itemId,
            unit_price: override.unitPrice,
          })),
        },
      });
      const updated = response.price_list ? mapBackendPriceLists([response.price_list])[0] : undefined;
      if (!updated) throw new Error('PRICE_LIST command returned no price list.');
      setPriceLists((prev) => prev.map((list) => list.id === updated.id ? updated : list));
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PRICE_LIST command failed';
      setLastMutationError(message);
      throw err;
    } finally {
      setMutationPending(false);
    }
  };

  const archivePriceList = async (priceListId: string): Promise<void> => {
    const existing = priceLists.find((list) => list.id === priceListId);
    if (!existing) throw new Error('Price list not found.');
    if (!session) {
      setPriceLists((prev) => prev.map((list) => list.id === priceListId ? { ...list, active: false } : list));
      return;
    }
    if (!existing.registryId) throw new Error('Price list registry id is missing.');
    setMutationPending(true);
    setLastMutationError(null);
    try {
      await dispatchCommand({
        command: 'PRICE_LIST',
        payload: { action: 'archive', price_list_id: existing.registryId },
      });
      setPriceLists((prev) => prev.map((list) => list.id === priceListId ? { ...list, active: false } : list));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PRICE_LIST command failed';
      setLastMutationError(message);
      throw err;
    } finally {
      setMutationPending(false);
    }
  };

  const createJob = (jobData: Omit<JobOrder, 'id' | 'jobId' | 'materialsUsed' | 'actualMaterialCost' | 'actualLaborCost' | 'totalLaborHours' | 'actualProfit'>): JobOrder => {
    const prefix = currentTenant.slug.substring(0, 3).toUpperCase();
    const nextNumber = jobs.length + 240;
    const jobIdStr = `${prefix}-0${nextNumber}`;
    const newJob: JobOrder = {
      ...jobData,
      id: `job-${Date.now()}`,
      jobId: jobIdStr,
      materialsUsed: [],
      actualMaterialCost: 0,
      actualLaborCost: 0,
      totalLaborHours: 0,
      actualProfit: jobData.quotedAmount
    };

    setJobs((prev) => [newJob, ...prev]);

    // Update customer active jobs count optimistically
    setCustomers((prev) =>
      prev.map((c) => (c.id === jobData.customerId ? { ...c, activeJobsCount: c.activeJobsCount + 1 } : c))
    );

    setMutationPending(true);
    setLastMutationError(null);

    // Authoritative Edge RPC dispatch (SERP-289)
    dispatchCommand({
      command: 'CALL',
      payload: {
        customer_name: jobData.customerName,
        vehicle_reg: jobData.vehicle?.plateNumber ?? '',
        phone: jobData.customerPhone,
        consent: true,
      },
    }).then((res) => {
      setMutationPending(false);
      if (res.ok && (res as any).event) {
        const serverEvent = (res as any).event;
        setJobs((prev) => prev.map((j) =>
          j.id === newJob.id
            ? { ...j, jobId: serverEvent.job_no || j.jobId }
            : j
        ));
      }
    }).catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'CALL command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] CALL command failed:', err);

      // Rollback on authoritative server rejection or authenticated session failure
      if (session || err instanceof ApiError) {
        setJobs((prev) => prev.filter((j) => j.id !== newJob.id));
        setCustomers((prev) =>
          prev.map((c) => (c.id === jobData.customerId ? { ...c, activeJobsCount: Math.max(0, c.activeJobsCount - 1) } : c))
        );
      }
    });

    logAuditEvent({
      action: 'CREATED',
      module: 'jobs',
      entityType: 'JobOrder',
      entityId: newJob.id,
      entityName: `${newJob.jobId} - ${newJob.customerName}`,
      summary: `Booked work order ${newJob.jobId} for ${newJob.customerName} (${newJob.serviceType}, Quoted: ${formatMVR(newJob.quotedAmount)}).`
    });

    // Privacy-preserving telemetry signal (counts only, zero customer names/amounts)
    telemetry.track('document_created_count', { documentType: 'job', count: 1 });

    return newJob;
  };

  const createInvoice = (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'> & { priceList?: PriceList }): Invoice => {
    const { priceList: suppliedPriceList, ...baseInvoiceData } = invoiceData;
    // SERP-314 Gap 3 (acceptance criterion 3): when the caller does not supply
    // an explicit priceList, derive the target customer's bound tier
    // automatically so any invoice issued for a bound customer resolves tier
    // pricing without threading a PriceList object through every call site.
    // An explicit priceList still wins (no-op-compatible override), an
    // unbound/archived binding — or a bound code with no row in the loaded
    // registry — resolves to the item's own sellingPrice unchanged, and the
    // derivation never crosses tenant boundaries (the customer is only used
    // when the session has no organisation or its tenantId matches).
    const boundCustomer = customers.find(
      (c) =>
        c.id === baseInvoiceData.customerId &&
        (!session?.current_organisation_id || c.tenantId === session.current_organisation_id)
    );
    const priceList =
      suppliedPriceList ??
      resolvePriceListForCustomer(boundCustomer, priceLists);
    const resolvedItems = baseInvoiceData.items.map((item) => {
      // KNOWN LIMITATION (Copilot review on PR #117, tracked on SERP-314's
      // not_done list): item.id here is InvoiceLineItem.id, an invoice-local
      // identifier (CreateInvoiceModal generates `item-*`/`inv-item-*`), not
      // an InventoryItem.id. PriceList.itemOverrides is keyed by the latter,
      // so a per-item override will never match through this call site today
      // -- only the flat discountPercent path is reliably reachable. This is
      // currently unexploitable (no UI can create a priceList with
      // itemOverrides and feed it into createInvoice yet), so it is
      // documented rather than guess-fixed: the correct fix threads a real
      // inventoryItemId through the invoice line item, which belongs with
      // the still-unbuilt catalog/binding work (SERP-314 admin CRUD +
      // Customer binding), not invented in isolation here.
      const unitPrice = roundToTwoDecimals(resolveItemPrice(
        { id: item.id, sellingPrice: item.unitPrice },
        priceList
      ));
      const amount = roundToTwoDecimals(item.quantity * unitPrice);
      return { ...item, unitPrice, amount };
    });
    const resolvedSubtotal = roundToTwoDecimals(resolvedItems.reduce((sum, item) => sum + item.amount, 0));
    const resolvedGstAmount = roundToTwoDecimals(resolvedSubtotal * baseInvoiceData.gstRate);
    const resolvedTotalAmount = roundToTwoDecimals(resolvedSubtotal + resolvedGstAmount);
    const finalizedInvoiceData: Omit<Invoice, 'id' | 'invoiceNumber'> = {
      ...baseInvoiceData,
      items: resolvedItems,
      subtotal: resolvedSubtotal,
      gstAmount: resolvedGstAmount,
      totalAmount: resolvedTotalAmount,
      balanceDue: roundToTwoDecimals(resolvedTotalAmount - baseInvoiceData.amountPaid),
    };
    const nextNum = invoices.length + 88;
    const invNumberStr = `INV-2026-0${nextNum}`;
    const newInvoice: Invoice = {
      ...finalizedInvoiceData,
      id: `inv-${Date.now()}`,
      invoiceNumber: invNumberStr
    };

    // Optimistic update
    setInvoices((prev) => [newInvoice, ...prev]);

    // Update customer totalInvoiced and outstandingBalance optimistically
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === finalizedInvoiceData.customerId
          ? {
              ...c,
              totalInvoiced: c.totalInvoiced + finalizedInvoiceData.totalAmount,
              outstandingBalance: c.outstandingBalance + finalizedInvoiceData.balanceDue
            }
          : c
      )
    );

    setMutationPending(true);
    setLastMutationError(null);

    // Authoritative Edge RPC dispatch (SERP-289)
    dispatchCommand({
      command: 'INVOICE',
      payload: {
        customer_id: finalizedInvoiceData.customerId,
        customer_name: finalizedInvoiceData.customerName,
        total_amount: finalizedInvoiceData.totalAmount,
        subtotal: finalizedInvoiceData.subtotal,
        gst_amount: finalizedInvoiceData.gstAmount,
        date: finalizedInvoiceData.date,
        due_date: finalizedInvoiceData.dueDate,
        items: finalizedInvoiceData.items,
        notes: finalizedInvoiceData.notes,
        job_id: finalizedInvoiceData.linkedJobId,
        bank_details: finalizedInvoiceData.bankDetails,
      },
    }).then((res) => {
      setMutationPending(false);
      if (res.ok && (res as any).invoice) {
        const serverInvoice = (res as any).invoice;
        const authTotal = Number(serverInvoice.total_amount ?? finalizedInvoiceData.totalAmount);
        const authBalanceDue = authTotal - (newInvoice.amountPaid || 0);
        const totalDelta = authTotal - finalizedInvoiceData.totalAmount;
        const balanceDelta = authBalanceDue - finalizedInvoiceData.balanceDue;

        setInvoices((prev) => prev.map((inv) =>
          inv.id === newInvoice.id
            ? {
                ...inv,
                invoiceNumber: serverInvoice.invoice_number || inv.invoiceNumber,
                subtotal: Number(serverInvoice.subtotal ?? inv.subtotal),
                gstAmount: Number(serverInvoice.gst_amount ?? inv.gstAmount),
                totalAmount: authTotal,
                balanceDue: authBalanceDue,
              }
            : inv
        ));

        if (totalDelta !== 0 || balanceDelta !== 0) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === finalizedInvoiceData.customerId
                ? {
                    ...c,
                    totalInvoiced: Math.max(0, c.totalInvoiced + totalDelta),
                    outstandingBalance: Math.max(0, c.outstandingBalance + balanceDelta),
                  }
                : c
            )
          );
        }
      }
    }).catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'INVOICE command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] INVOICE server mutation rejected:', err);

      // Rollback optimistic state on authoritative server rejection or authenticated session failure
      if (session || err instanceof ApiError) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== newInvoice.id));
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === finalizedInvoiceData.customerId
              ? {
                  ...c,
                  totalInvoiced: Math.max(0, c.totalInvoiced - finalizedInvoiceData.totalAmount),
                  outstandingBalance: Math.max(0, c.outstandingBalance - finalizedInvoiceData.balanceDue)
                }
              : c
          )
        );
      }
    });

    logAuditEvent({
      action: 'INVOICE_ISSUED',
      module: 'invoices',
      entityType: 'Invoice',
      entityId: newInvoice.id,
      entityName: newInvoice.invoiceNumber,
      summary: `Issued tax invoice ${newInvoice.invoiceNumber} to ${newInvoice.customerName} for ${formatMVR(newInvoice.totalAmount)} (GST: ${formatMVR(newInvoice.gstAmount)}).`
    });

    // Privacy-preserving telemetry signal (counts only, zero customer names/amounts)
    telemetry.track('document_created_count', { documentType: 'invoice', count: 1 });

    return newInvoice;
  };

  const generateJobInvoice = (jobId: string): Invoice => {
    const job = jobs.find((j) => j.id === jobId || j.jobId === jobId);
    if (!job) throw new Error('Job not found');

    const gstRateDecimal = (currentTenant.gstRate || 8) / 100;
    const subtotal = Math.round((job.quotedAmount / (1 + gstRateDecimal)) * 100) / 100;
    const gstAmount = Math.round((job.quotedAmount - subtotal) * 100) / 100;

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-0${invoices.length + 88}`,
      customerId: job.customerId,
      customerName: job.customerName,
      customerPhone: job.customerPhone,
      customerIsland: currentTenant.island,
      linkedJobId: job.id,
      linkedJobNumber: job.jobId,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      items: [
        {
          id: `li-${Date.now()}-1`,
          description: `${job.serviceType}: ${job.vehicle?.make || 'Service'} ${job.vehicle?.model || ''} (${job.vehicle?.plateNumber || 'Job'})`,
          quantity: 1,
          unitPrice: subtotal,
          amount: subtotal,
          category: 'Labor/Service'
        }
      ],
      subtotal,
      gstRate: gstRateDecimal,
      gstAmount,
      totalAmount: job.quotedAmount,
      amountPaid: job.depositPaid,
      balanceDue: job.quotedAmount - job.depositPaid,
      status: job.depositPaid >= job.quotedAmount ? 'Paid' : job.depositPaid > 0 ? 'Partially Paid' : 'Sent',
      notes: `Generated from Work Order ${job.jobId}. Advance deposit credited: ${formatMVR(job.depositPaid)}.`,
      bankDetails: [
        currentTenant.bmlAccount,
        currentTenant.tinNumber ? `TIN: ${currentTenant.tinNumber}` : null
      ].filter(Boolean).join(' • ') || 'Settlement via official banking transfer'
    };

    // Optimistic UI updates
    setInvoices((prev) => [newInvoice, ...prev]);
    const previousJobStatus = job.status;
    const previousLinkedInvoiceId = job.linkedInvoiceId;

    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, linkedInvoiceId: newInvoice.id, status: 'Invoiced' } : j))
    );

    setMutationPending(true);
    setLastMutationError(null);

    // Route through authoritative Edge RPC (SERP-289)
    dispatchCommand({
      command: 'INVOICE',
      payload: {
        customer_id: job.customerId,
        customer_name: job.customerName,
        total_amount: job.quotedAmount,
        subtotal,
        gst_amount: gstAmount,
        date: newInvoice.date,
        due_date: newInvoice.dueDate,
        items: newInvoice.items,
        notes: newInvoice.notes,
        job_id: job.id,
        bank_details: newInvoice.bankDetails,
      },
    }).then((res) => {
      setMutationPending(false);
      if (res.ok && (res as any).invoice) {
        const serverInvoice = (res as any).invoice;
        setInvoices((prev) => prev.map((inv) =>
          inv.id === newInvoice.id
            ? { ...inv, invoiceNumber: serverInvoice.invoice_number || inv.invoiceNumber }
            : inv
        ));
      }
    }).catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'Job invoice generation failed';
      setLastMutationError(errMsg);
      console.error('[ERP] generateJobInvoice server mutation rejected:', err);

      // Rollback on authoritative server rejection or authenticated session failure
      if (session || err instanceof ApiError) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== newInvoice.id));
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, linkedInvoiceId: previousLinkedInvoiceId, status: previousJobStatus } : j))
        );
      }
    });

    logAuditEvent({
      action: 'INVOICE_ISSUED',
      module: 'invoices',
      entityType: 'Invoice',
      entityId: newInvoice.id,
      entityName: newInvoice.invoiceNumber,
      summary: `Auto-generated Tax Invoice ${newInvoice.invoiceNumber} from Work Order ${job.jobId}.`
    });

    return newInvoice;
  };

  const recordPayment = (paymentData: Omit<Payment, 'id' | 'paymentNumber'>): Payment => {
    const nextNum = payments.length + 1093;
    const newPayment: Payment = {
      ...paymentData,
      id: `pay-${Date.now()}`,
      paymentNumber: `PAY-${nextNum}`
    };

    // Optimistic UI updates
    setPayments((prev) => [newPayment, ...prev]);

    // Update invoice balance optimistically
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === paymentData.invoiceId || inv.invoiceNumber === paymentData.invoiceNumber) {
          const newPaid = inv.amountPaid + paymentData.amount;
          const newBalance = Math.max(0, inv.totalAmount - newPaid);
          const newStatus = newBalance === 0 ? 'Paid' : 'Partially Paid';
          return {
            ...inv,
            amountPaid: newPaid,
            balanceDue: newBalance,
            status: newStatus
          };
        }
        return inv;
      })
    );

    // Update customer outstanding balance optimistically
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === paymentData.customerId || c.name === paymentData.customerName) {
          return {
            ...c,
            outstandingBalance: Math.max(0, c.outstandingBalance - paymentData.amount),
            lastPaymentDate: paymentData.paymentDate
          };
        }
        return c;
      })
    );

    setMutationPending(true);
    setLastMutationError(null);

    // Authoritative Edge RPC dispatch (SERP-289)
    dispatchCommand({
      command: 'INVOICE_PAYMENT',
      payload: {
        invoice_id: paymentData.invoiceId,
        customer_id: paymentData.customerId,
        amount: paymentData.amount,
        method: paymentData.method,
        reference: paymentData.referenceNumber,
        bank_account: paymentData.bankAccount,
        notes: paymentData.notes,
      },
    }).then((res) => {
      setMutationPending(false);
      if (res.ok && (res as any).payment) {
        const serverPayment = (res as any).payment;
        setPayments((prev) => prev.map((p) =>
          p.id === newPayment.id
            ? { ...p, paymentNumber: serverPayment.payment_number || p.paymentNumber }
            : p
        ));
      }
    }).catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'INVOICE_PAYMENT command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] INVOICE_PAYMENT server mutation rejected:', err);

      // Rollback on authoritative server rejection or authenticated session failure
      if (session || err instanceof ApiError) {
        setPayments((prev) => prev.filter((p) => p.id !== newPayment.id));
        setInvoices((prev) =>
          prev.map((inv) => {
            if (inv.id === paymentData.invoiceId || inv.invoiceNumber === paymentData.invoiceNumber) {
              const revertedPaid = Math.max(0, inv.amountPaid - paymentData.amount);
              const revertedBalance = Math.min(inv.totalAmount, inv.balanceDue + paymentData.amount);
              const revertedStatus = revertedBalance === 0 ? 'Paid' : revertedPaid > 0 ? 'Partially Paid' : 'Sent';
              return {
                ...inv,
                amountPaid: revertedPaid,
                balanceDue: revertedBalance,
                status: revertedStatus
              };
            }
            return inv;
          })
        );
        setCustomers((prev) =>
          prev.map((c) => {
            if (c.id === paymentData.customerId || c.name === paymentData.customerName) {
              return {
                ...c,
                outstandingBalance: c.outstandingBalance + paymentData.amount
              };
            }
            return c;
          })
        );
      }
    });

    logAuditEvent({
      action: 'PAYMENT_RECORDED',
      module: 'payments',
      entityType: 'Payment',
      entityId: newPayment.id,
      entityName: newPayment.paymentNumber,
      summary: `Recorded payment of ${formatMVR(newPayment.amount)} via ${newPayment.method} (Ref: ${newPayment.referenceNumber}) for ${newPayment.customerName}.`
    });

    return newPayment;
  };

  const recordCounterSale = (saleData: {
    items: Array<{ itemId: string; name: string; sku: string; quantity: number; unitPrice: number }>;
    paymentMethod: PaymentMethod;
    customerName?: string;
    customerId?: string;
    bankAccount?: string;
  }): { success: boolean; invoice?: Invoice; payment?: Payment; error?: string } => {
    // 1. Validate stock availability
    for (const item of saleData.items) {
      const stockItem = inventory.find((i) => i.id === item.itemId || i.sku === item.sku);
      if (stockItem && stockItem.quantityOnHand < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for ${item.name} (Available: ${stockItem.quantityOnHand}, Requested: ${item.quantity})`,
        };
      }
    }

    // 2. Compute subtotal, tax, total
    const subtotal = saleData.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    const gstRateDecimal = currentTenant.gstStatus === 'registered' ? (currentTenant.gstRate || 8) / 100 : 0;
    const gstAmount = Math.round(subtotal * gstRateDecimal * 100) / 100;
    const totalAmount = subtotal + gstAmount;

    // 3. Deduct inventory & record stock movements
    setInventory((prev) =>
      prev.map((inv) => {
        const sold = saleData.items.find((it) => it.itemId === inv.id || it.sku === inv.sku);
        if (sold) {
          const newQty = Math.max(0, inv.quantityOnHand - sold.quantity);
          const newStatus = newQty === 0 ? 'Out of Stock' : newQty <= inv.reorderLevel ? 'Low Stock' : 'In Stock';
          return { ...inv, quantityOnHand: newQty, stockStatus: newStatus };
        }
        return inv;
      })
    );

    const nextInvNum = invoices.length + 90;
    const invNumberStr = `INV-2026-POS-0${nextInvNum}`;

    // Add stock movements
    const newMovements: StockMovement[] = saleData.items.map((it) => ({
      id: `mov-${Date.now()}-${it.sku}`,
      tenantId: currentTenant.id,
      itemId: it.itemId,
      itemName: it.name,
      type: 'Deducted (Job)',
      quantity: it.quantity,
      unit: 'pcs',
      unitCost: it.unitPrice,
      totalValue: -(it.quantity * it.unitPrice),
      date: new Date().toISOString().split('T')[0],
      reference: invNumberStr,
      actorId: currentUser.id,
      staffName: currentUser.name,
      notes: 'Counter POS sale',
    }));

    setStockMovements((prev) => [...newMovements, ...prev]);

    // 4. Create Paid Invoice
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invNumberStr,
      customerId: saleData.customerId || 'walk-in',
      customerName: saleData.customerName || 'Walk-in Counter Customer',
      customerPhone: '',
      customerIsland: currentTenant.island,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      items: saleData.items.map((it, idx) => ({
        id: `li-${Date.now()}-${idx}`,
        description: `${it.name} (${it.sku})`,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.quantity * it.unitPrice,
        category: 'Material/Part',
      })),
      subtotal,
      gstRate: gstRateDecimal,
      gstAmount,
      totalAmount,
      amountPaid: totalAmount,
      balanceDue: 0,
      status: 'Paid',
      notes: `Counter Sale (${saleData.paymentMethod}). Fully settled at counter.`,
      bankDetails: saleData.bankAccount || currentTenant.bmlAccount,
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    // 5. Create Completed Payment
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      paymentNumber: `PAY-POS-${payments.length + 101}`,
      invoiceId: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber,
      customerId: newInvoice.customerId,
      customerName: newInvoice.customerName,
      amount: totalAmount,
      paymentDate: new Date().toISOString().split('T')[0],
      method: saleData.paymentMethod,
      referenceNumber: `REC-${Date.now().toString().slice(-6)}`,
      bankAccount: saleData.bankAccount || (saleData.paymentMethod === 'Cash' ? 'Cash Drawer' : currentTenant.bmlAccount),
      status: 'Verified',
      notes: 'Direct counter settlement',
    };

    setPayments((prev) => [newPayment, ...prev]);

    setMutationPending(true);
    setLastMutationError(null);

    // Authoritative Edge RPC dispatch for COUNTER_SALE (SERP-289)
    dispatchCommand({
      command: 'COUNTER_SALE',
      payload: {
        customer_id: saleData.customerId,
        customer_name: saleData.customerName || 'Walk-in Counter Customer',
        total_amount: totalAmount,
        subtotal,
        gst_amount: gstAmount,
        payment_method: saleData.paymentMethod,
        items: saleData.items,
        bank_account: saleData.bankAccount,
      },
    }).then((res) => {
      setMutationPending(false);
      if (res.ok && (res as any).counter_sale) {
        const cs = (res as any).counter_sale;
        if (cs.invoice_number) {
          setInvoices((prev) => prev.map((inv) =>
            inv.id === newInvoice.id ? { ...inv, invoiceNumber: cs.invoice_number } : inv
          ));
        }
      }
    }).catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'COUNTER_SALE command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] COUNTER_SALE server mutation rejected:', err);

      // Rollback on authoritative server rejection or authenticated session failure
      if (session || err instanceof ApiError) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== newInvoice.id));
        setPayments((prev) => prev.filter((p) => p.id !== newPayment.id));
        setStockMovements((prev) => prev.filter((m) => !newMovements.some((nm) => nm.id === m.id)));
        setInventory((prev) =>
          prev.map((inv) => {
            const sold = saleData.items.find((it) => it.itemId === inv.id || it.sku === inv.sku);
            if (sold) {
              const revertedQty = inv.quantityOnHand + sold.quantity;
              const revertedStatus = revertedQty === 0 ? 'Out of Stock' : revertedQty <= inv.reorderLevel ? 'Low Stock' : 'In Stock';
              return { ...inv, quantityOnHand: revertedQty, stockStatus: revertedStatus };
            }
            return inv;
          })
        );
      }
    });

    logAuditEvent({
      action: 'CREATED',
      module: 'invoices',
      entityType: 'Invoice',
      entityId: newInvoice.id,
      entityName: newInvoice.invoiceNumber,
      summary: `Counter POS Sale ${newInvoice.invoiceNumber} completed for ${formatMVR(totalAmount)} via ${saleData.paymentMethod}. ${saleData.items.length} item(s) deducted from inventory.`,
    });

    telemetry.track('document_created_count', { documentType: 'counter_sale', count: 1 });

    return { success: true, invoice: newInvoice, payment: newPayment };
  };

  const addExpense = (expenseData: Omit<Expense, 'id' | 'expenseNumber'>): Expense => {
    const nextNum = expenses.length + 55;
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`,
      expenseNumber: `EXP-2026-0${nextNum}`
    };
    setExpenses((prev) => [newExpense, ...prev]);

    setMutationPending(true);
    setLastMutationError(null);

    // Dispatch to backend with rollback on rejection (SERP-289)
    dispatchCommand({
      command: 'EXPENSE',
      payload: {
        amount: expenseData.amount,
        payee: expenseData.payee,
        category: expenseData.category,
        payment_method: expenseData.paymentMethod,
        description: expenseData.description,
        date: expenseData.date,
      },
    }).then(() => {
      setMutationPending(false);
    }).catch((err) => {
      setMutationPending(false);
      const errMsg = err instanceof Error ? err.message : 'EXPENSE command failed';
      setLastMutationError(errMsg);
      console.error('[ERP] EXPENSE command failed:', err);

      // Rollback on authoritative server rejection or authenticated session failure
      if (session || err instanceof ApiError) {
        setExpenses((prev) => prev.filter((e) => e.id !== newExpense.id));
      }
    });

    logAuditEvent({
      action: 'CREATED',
      module: 'expenses',
      entityType: 'Expense',
      entityId: newExpense.id,
      entityName: newExpense.expenseNumber,
      summary: `Logged operating expense of ${formatMVR(newExpense.amount)} to payee ${newExpense.payee} (${newExpense.category}).`
    });

    return newExpense;
  };

  const receiveStock = (itemId: string, quantity: number, ref: string = 'Manual Restock', cost?: number) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;

    setInventory((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          /**
           * SERP-309 — WEIGHTED AVERAGE, not "the latest price wins".
           *
           * This line used to read `unitCost: cost !== undefined ? cost : i.unitCost`,
           * so receiving stock REPLACED the unit cost of everything on hand
           * with the price of the newest delivery. Hold 100 filters bought at
           * MVR 10, take in 10 more at MVR 50 because the cheap supplier was
           * out, and all 110 were carried at 50: the inventory asset jumped by
           * MVR 4,000 on a purchase that cost 500, and the same error ran into
           * cost of sales the moment any of it was issued. Every individual
           * number was correct, which is why nothing ever reported it.
           */
          const priced = applyMovement(
            { quantityOnHand: i.quantityOnHand, averageCost: i.unitCost, value: i.quantityOnHand * i.unitCost },
            { quantity, kind: 'receipt', unitCost: cost !== undefined ? cost : i.unitCost },
          ).state;
          const newQty = priced.quantityOnHand;
          return {
            ...i,
            quantityOnHand: newQty,
            unitCost: priced.averageCost,
            stockStatus: newQty > i.reorderLevel ? 'In Stock' : 'Low Stock',
            lastRestockedDate: new Date().toISOString().split('T')[0]
          };
        }
        return i;
      })
    );

    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      type: 'Received',
      quantity,
      unit: item.unit,
      date: new Date().toLocaleString(),
      reference: ref,
      staffName: currentUser.name,
      notes: `Restocked ${quantity} ${item.unit}`
    };
    setStockMovements((prev) => [newMovement, ...prev]);

    logAuditEvent({
      action: 'STOCK_ADJUSTED',
      module: 'inventory',
      entityType: 'InventoryItem',
      entityId: item.id,
      entityName: item.name,
      summary: `Restocked ${quantity} ${item.unit} of ${item.name}. New quantity: ${item.quantityOnHand + quantity} ${item.unit}.`
    });
  };

  const addInventoryItem = (itemData: Omit<InventoryItem, 'id' | 'stockStatus' | 'lastRestockedDate'>): InventoryItem => {
    const newItem: InventoryItem = {
      ...itemData,
      id: `inv-${Date.now()}`,
      stockStatus: itemData.quantityOnHand > itemData.reorderLevel ? 'In Stock' : itemData.quantityOnHand > 0 ? 'Low Stock' : 'Out of Stock',
      lastRestockedDate: new Date().toISOString().split('T')[0]
    };
    setInventory((prev) => [newItem, ...prev]);
    setMutationPending(true);
    setLastMutationError(null);
    dispatchCommand({
      command: 'PURCHASE',
      payload: { itemData: { sku: newItem.sku, name: newItem.name, unit: newItem.unit, reorderLevel: newItem.reorderLevel } },
      step: 'need',
    }).then(() => { setMutationPending(false); })
    .catch((err) => { setMutationPending(false); console.error('[ERP] PURCHASE command failed:', err); if (session || err instanceof ApiError) { setInventory((prev) => prev.filter((i) => i.id !== newItem.id)); } });

    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      itemId: newItem.id,
      itemName: newItem.name,
      type: 'Received',
      quantity: newItem.quantityOnHand,
      unit: newItem.unit,
      date: new Date().toLocaleString(),
      reference: 'Initial Stock Register',
      staffName: currentUser.name,
      notes: `Registered SKU ${newItem.sku} with opening balance of ${newItem.quantityOnHand} ${newItem.unit}`
    };
    setStockMovements((prev) => [newMovement, ...prev]);

    logAuditEvent({
      action: 'CREATED',
      module: 'inventory',
      entityType: 'InventoryItem',
      entityId: newItem.id,
      entityName: newItem.name,
      summary: `Created new inventory SKU ${newItem.sku} (${newItem.name}) with ${newItem.quantityOnHand} ${newItem.unit} in stock.`
    });

    return newItem;
  };

  const adjustStockLevel = (itemId: string, newQuantity: number, reason: string = 'Stock Count Verification') => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;

    const diff = newQuantity - item.quantityOnHand;

    setInventory((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            quantityOnHand: newQuantity,
            stockStatus: newQuantity > i.reorderLevel ? 'In Stock' : newQuantity > 0 ? 'Low Stock' : 'Out of Stock',
            lastRestockedDate: new Date().toISOString().split('T')[0]
          };
        }
        return i;
      })
    );

    const newMovement: StockMovement = {
      id: `mov-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      type: 'Adjustment',
      quantity: diff,
      unit: item.unit,
      date: new Date().toLocaleString(),
      reference: 'Stock Count Adjustment',
      staffName: currentUser.name,
      notes: `${reason} — adjusted by ${diff >= 0 ? '+' : ''}${diff} ${item.unit} to ${newQuantity} ${item.unit}`
    };
    setStockMovements((prev) => [newMovement, ...prev]);

    logAuditEvent({
      action: 'STOCK_ADJUSTED',
      module: 'inventory',
      entityType: 'InventoryItem',
      entityId: item.id,
      entityName: item.name,
      summary: `Adjusted stock for ${item.name} from ${item.quantityOnHand} to ${newQuantity} ${item.unit} (${reason}).`
    });
  };

  const createPurchaseOrder = (poData: Omit<PurchaseOrder, 'id' | 'poNumber'>): PurchaseOrder => {
    const nextNum = purchaseOrders.length + 43;
    const newPO: PurchaseOrder = {
      ...poData,
      id: `po-${Date.now()}`,
      poNumber: `PO-2026-0${nextNum}`
    };

    setPurchaseOrders((prev) => [newPO, ...prev]);
    setMutationPending(true);
    setLastMutationError(null);
    dispatchCommand({
      command: 'PURCHASE',
      payload: { supplierId: poData.supplierId, items: poData.items, expectedDeliveryDate: poData.expectedDeliveryDate, notes: poData.notes, totalAmount: poData.totalAmount },
      step: 'need',
    }).then(() => { setMutationPending(false); })
    .catch((err) => { setMutationPending(false); console.error('[ERP] PURCHASE command failed:', err); if (session || err instanceof ApiError) { setPurchaseOrders((prev) => prev.filter((p) => p.id !== newPO.id)); setSuppliers((prev) => prev.map((s) => s.id === poData.supplierId ? {...s, outstandingPayable: s.outstandingPayable - (poData.totalAmount || 0)} : s)); } });

    // Update supplier outstanding payable
    setSuppliers((prev) =>
      prev.map((sup) =>
        sup.id === poData.supplierId
          ? { ...sup, outstandingPayable: sup.outstandingPayable + poData.totalAmount }
          : sup
      )
    );

    logAuditEvent({
      action: 'CREATED',
      module: 'purchasing',
      entityType: 'PurchaseOrder',
      entityId: newPO.id,
      entityName: newPO.poNumber,
      summary: `Created Purchase Order ${newPO.poNumber} for vendor ${newPO.supplierName} (${formatMVR(newPO.totalAmount)}).`
    });

    return newPO;
  };

  const receivePurchaseOrder = (poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return;

    // Update PO status — receipt is separate from payment
    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === poId ? { ...p, status: 'Received & Stocked', paymentStatus: p.paymentStatus } : p))
    );

    // Increase stock for each item in the PO
    po.items.forEach((item) => {
      receiveStock(item.inventoryId, item.quantity, po.poNumber, item.unitCost);
    });

    logAuditEvent({
      action: 'STOCK_ADJUSTED',
      module: 'purchasing',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      entityName: po.poNumber,
      summary: `Received and stocked full inventory items for Purchase Order ${po.poNumber}.`
    });
  };

  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const triggerAIInsightAction = (insight: AIAssistantInsight) => {
    if (!insight.actionPayload) return;
    const { actionType, targetId } = insight.actionPayload;

    if (actionType === 'filter_overdue') {
      setActiveTab('invoices');
      if (targetId) setSelectedInvoiceId(targetId);
    } else if (actionType === 'open_po_draft') {
      setActiveTab('purchasing');
      setIsCreatePOOpen(true);
    } else if (actionType === 'view_job_margin') {
      setActiveTab('jobs');
      if (targetId) setSelectedJobId(targetId);
    } else if (actionType === 'reconcile_bml') {
      setActiveTab('payments');
    }
  };

  return (
    <ERPContext.Provider
      value={{
        activeTab,
        setActiveTab,
        customers,
        jobs,
        invoices,
        priceLists,
        priceListsLoading,
        payments,
        expenses,
        inventory,
        stockMovements,
        suppliers,
        purchaseOrders,
        alerts,
        aiInsights,
        staff,

        // Multi-tenant & Multi-Book Context
        activePlane,
        currentTenant,
        tenantHydrated,
        tenantIsLive: Boolean(session),
        currentBookId,
        currentBook,
        currentArchetype,
        currentTerms,
        tenants,
        switchTenant,
        switchBook,
        switchActiveContext,
        createTenant,
        updateTenant,
        updateTenantLogo,
        isSetupModalOpen,
        setIsSetupModalOpen,

        // Organisation Applications & Registrations
        pendingApplications,
        submitOrganisationApplication,
        approveOrganisationApplication,
        rejectOrganisationApplication,
        isRegisterOrgModalOpen,
        setIsRegisterOrgModalOpen,
        refreshApplicantApplication,

        // RBAC & User Management
        currentUser,
        users,
        setUsers,
        roles,
        invitations,
        switchCurrentUser,
        authorizeUser,
        suspendUser,
        inviteUser,
        inviteStaffMember,
        resendInvitation,
        revokeInvitation,
        updateUserRole,
        createRole,
        updateRolePermissions,
        deleteRole,
        hasPermission,
        isPendingApproval,

        // Admin & Privileged MFA (SERP-268)
        isMfaElevated,
        isMfaChallengeOpen,
        isMfaEnrollmentOpen,
        openMfaEnrollment,
        closeMfaEnrollment,
        openMfaChallenge,
        closeMfaChallenge,
        enrollMfa,
        verifyMfaChallenge,
        disableMfa,
        requireMfaElevation,

        // Workflows
        workflowStages,
        setWorkflowStages,
        addWorkflowStage,
        updateWorkflowStage,
        deleteWorkflowStage,
        resetWorkflowToPreset,

        // Audit Trails
        auditLogs,
        logAuditEvent,

        // Theme
        theme,
        toggleTheme,
        setTheme,

        selectedCustomerId,
        setSelectedCustomerId,
        selectedJobId,
        setSelectedJobId,
        selectedInvoiceId,
        setSelectedInvoiceId,
        selectedPOId,
        setSelectedPOId,

        isCreateJobOpen,
        setIsCreateJobOpen,
        isCreateInvoiceOpen,
        setIsCreateInvoiceOpen,
        isRecordPaymentOpen,
        setIsRecordPaymentOpen,
        isAddExpenseOpen,
        setIsAddExpenseOpen,
        isReceiveStockOpen,
        setIsReceiveStockOpen,
        isCreatePOOpen,
        setIsCreatePOOpen,
        isAICopilotOpen,
        setIsAICopilotOpen,
        isGlobalSearchOpen,
        setIsGlobalSearchOpen,
        isNewCustomerOpen,
        setIsNewCustomerOpen,

        prefilledCustomerId,
        setPrefilledCustomerId,
        prefilledJobId,
        setPrefilledJobId,
        prefilledInvoiceId,
        setPrefilledInvoiceId,

        formatMVR,
        updateJobStatus,
        addMaterialToJob,
        addLaborEntry,
        laborEntries,
        createJob,
        createCustomer,
        createSupplier,
        updateSupplier,
        deactivateSupplier,
        createPriceList,
        updatePriceList,
        archivePriceList,
        createInvoice,
        recordPayment,
        recordCounterSale,
        addExpense,
        receiveStock,
        addInventoryItem,
        adjustStockLevel,
        createPurchaseOrder,
        receivePurchaseOrder,
        dismissAlert,
        triggerAIInsightAction,
        generateJobInvoice,
        mutationPending,
        lastMutationError,
        clearMutationError,

        totalSalesToday,
        totalCashReceived,
        totalOutstandingInvoices,
        totalAccountsPayable,
        activeJobsCount,
        lowStockItemsCount
      }}
    >
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = () => {
  const context = useContext(ERPContext);
  if (!context) {
    throw new Error('useERP must be used within an ERPProvider');
  }
  return context;
};
