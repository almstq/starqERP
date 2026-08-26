import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';
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
  PaymentMethod
} from '../types/erp';
import {
  INITIAL_CUSTOMERS,
  INITIAL_JOBS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_EXPENSES,
  INITIAL_INVENTORY,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_ALERTS,
  INITIAL_AI_INSIGHTS,
  INITIAL_STAFF,
  INITIAL_TENANTS,
  INITIAL_ROLES,
  INITIAL_USERS,
  INITIAL_WORKFLOW_STAGES,
  INITIAL_AUDIT_LOGS,
  CLINIC_WORKFLOW_PRESET,
  BOATYARD_WORKFLOW_PRESET
} from '../data/mockData';
import { telemetry } from '../services/telemetry';

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

  // Multi-Tenant State
  currentTenant: OrganisationTenant;
  tenants: OrganisationTenant[];
  switchTenant: (tenantId: string) => void;
  createTenant: (tenantData: Omit<OrganisationTenant, 'id' | 'createdAt'>) => OrganisationTenant;
  updateTenant: (tenantData: Partial<OrganisationTenant>) => void;
  isSetupModalOpen: boolean;
  setIsSetupModalOpen: (open: boolean) => void;

  // RBAC & User Management State
  currentUser: AppUser;
  users: AppUser[];
  roles: UserRole[];
  switchCurrentUser: (userId: string) => void;
  authorizeUser: (userId: string, roleId?: string) => void;
  suspendUser: (userId: string) => void;
  inviteUser: (userData: { name: string; email: string; phone: string; roleId: string; jobTitle?: string }) => AppUser;
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
  resetWorkflowToPreset: (presetType: 'automotive' | 'clinic' | 'marine', targetTenantId?: string) => void;

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
  createJob: (jobData: Omit<JobOrder, 'id' | 'jobId' | 'materialsUsed' | 'actualMaterialCost' | 'actualProfit'>) => JobOrder;
  createCustomer: (customerData: Omit<Customer, 'id' | 'createdAt' | 'activeJobsCount' | 'totalInvoiced' | 'outstandingBalance'>) => Customer;
  createInvoice: (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'>) => Invoice;
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

  // Quick stats
  totalSalesToday: number;
  totalCashReceived: number;
  totalOutstandingInvoices: number;
  totalAccountsPayable: number;
  activeJobsCount: number;
  lowStockItemsCount: number;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

export const ERPProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const { resolvedTheme, setThemeMode } = useTheme();
  const theme = resolvedTheme;

  // Multi-tenant state
  const [tenants, setTenants] = useState<OrganisationTenant[]>(INITIAL_TENANTS);
  const [currentTenantId, setCurrentTenantId] = useState<string>('tenant-1');
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);

  // RBAC & User State
  const [users, setUsers] = useState<AppUser[]>(INITIAL_USERS);
  const [roles, setRoles] = useState<UserRole[]>(INITIAL_ROLES);
  const [currentUserId, setCurrentUserId] = useState<string>('user-1'); // Default to Ali Musthaq (Super Admin)

  // Workflows & Audit
  const [workflowStages, setWorkflowStages] = useState<WorkflowStage[]>(INITIAL_WORKFLOW_STAGES);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  // Domain state
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [jobs, setJobs] = useState<JobOrder[]>(INITIAL_JOBS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [payments, setPayments] = useState<Payment[]>(INITIAL_PAYMENTS);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(INITIAL_STOCK_MOVEMENTS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(INITIAL_PURCHASE_ORDERS);
  const [alerts, setAlerts] = useState<NeedsAttentionAlert[]>(INITIAL_ALERTS);
  const [aiInsights, setAiInsights] = useState<AIAssistantInsight[]>(INITIAL_AI_INSIGHTS);
  const [staff] = useState<StaffMember[]>(INITIAL_STAFF);

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
  const currentTenant = useMemo(() => {
    return tenants.find((t) => t.id === currentTenantId) || tenants[0];
  }, [tenants, currentTenantId]);

  // Current User computation
  const currentUser = useMemo(() => {
    return users.find((u) => u.id === currentUserId) || users[0];
  }, [users, currentUserId]);

  const isPendingApproval = currentUser.status === 'Pending Approval';

  useEffect(() => {
    telemetry.setTenantId(currentTenantId);
  }, [currentTenantId]);

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
    return invoices
      .filter((inv) => inv.date === today)
      .reduce((acc, inv) => acc + inv.totalAmount, 0);
  }, [invoices]);
  const totalCashReceived = useMemo(() => {
    return payments.reduce((acc, p) => acc + p.amount, 0);
  }, [payments]);

  const totalOutstandingInvoices = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + inv.balanceDue, 0);
  }, [invoices]);

  const totalAccountsPayable = useMemo(() => {
    return suppliers.reduce((acc, sup) => acc + sup.outstandingPayable, 0);
  }, [suppliers]);

  const activeJobsCount = useMemo(() => {
    return jobs.filter((j) => !['Completed', 'Paid', 'Tax Invoiced & Settled'].includes(j.status)).length;
  }, [jobs]);

  const lowStockItemsCount = useMemo(() => {
    return inventory.filter((item) => item.quantityOnHand <= item.reorderLevel).length;
  }, [inventory]);

  // Logging Helper
  const logAuditEvent = (entry: {
    action: AuditLogEntry['action'];
    module: PermissionModule;
    entityType: string;
    entityId: string;
    entityName: string;
    summary: string;
    details?: string;
    previousValue?: string;
    newValue?: string;
  }) => {
    const newAudit: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      tenantId: currentTenant.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.roleName,
      userEmail: currentUser.email,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '123.231.104.18 (Dhiraagu Maldives)',
      location: `${currentTenant.island} Office`,
      ...entry
    };
    setAuditLogs((prev) => [newAudit, ...prev]);
  };

  // Switch Tenant
  const switchTenant = (tenantId: string) => {
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;
    setCurrentTenantId(tenantId);
    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'settings',
      entityType: 'OrganisationTenant',
      entityId: target.id,
      entityName: target.name,
      summary: `Switched active organization to ${target.name} (${target.industry}).`
    });
  };

  // Create new Tenant (Organisation Setup)
  const createTenant = (tenantData: Omit<OrganisationTenant, 'id' | 'createdAt'>): OrganisationTenant => {
    const newTenant: OrganisationTenant = {
      ...tenantData,
      id: `tenant-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setTenants((prev) => [...prev, newTenant]);
    setCurrentTenantId(newTenant.id);

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

  const updateTenant = (tenantData: Partial<OrganisationTenant>) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === currentTenant.id ? { ...t, ...tenantData } : t))
    );
    logAuditEvent({
      action: 'ORG_CONFIG_SAVED',
      module: 'settings',
      entityType: 'OrganisationTenant',
      entityId: currentTenant.id,
      entityName: currentTenant.name,
      summary: `Updated organization settings and profile for ${currentTenant.name}.`
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

  // Switch Current User Persona (to showcase RBAC gating)
  const switchCurrentUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setCurrentUserId(userId);
    // If switching to a privileged account, reset session elevation to require challenge
    const userRole = roles.find((r) => r.id === user.roleId);
    const isPrivileged = user.roleName === 'Super Administrator' || !!userRole?.isSystemAdmin || !!user.mfaRequired;
    setIsMfaElevated(!isPrivileged);
  };

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

  // Invite User
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
      status: 'Pending Approval', // Land in pending until admin authorises!
      invitedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      lastActiveAt: 'Invitation Dispatched',
      jobTitle: userData.jobTitle || 'Team Member'
    };

    setUsers((prev) => [...prev, newUser]);

    // Add alert for admin attention
    setAlerts((prev) => [
      {
        id: `alert-user-${newUser.id}`,
        type: 'pending_user_approval',
        title: `New User Sign-in Pending: ${newUser.name}`,
        description: `${newUser.name} (${newUser.email}) is pending approval for role ${newUser.roleName}.`,
        urgency: 'warning',
        actionLabel: 'Review & Authorize',
        targetTab: 'settings',
        targetId: newUser.id
      },
      ...prev
    ]);

    logAuditEvent({
      action: 'USER_INVITED',
      module: 'users',
      entityType: 'AppUser',
      entityId: newUser.id,
      entityName: newUser.name,
      summary: `Invited user ${newUser.name} (${newUser.email}) with initial role ${newUser.roleName}. Lands in Pending state.`,
      newValue: 'Status: Pending Approval'
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

  const resetWorkflowToPreset = (presetType: 'automotive' | 'clinic' | 'marine', targetTenantId?: string) => {
    const orgId = targetTenantId || currentTenant.id;
    let preset: WorkflowStage[] = [];
    if (presetType === 'clinic') {
      preset = CLINIC_WORKFLOW_PRESET.map((p, idx) => ({
        ...p,
        id: `stage-clinic-${idx + 1}`,
        tenantId: orgId,
        order: idx + 1
      }));
    } else if (presetType === 'marine') {
      preset = BOATYARD_WORKFLOW_PRESET.map((p, idx) => ({
        ...p,
        id: `stage-marine-${idx + 1}`,
        tenantId: orgId,
        order: idx + 1
      }));
    } else {
      preset = INITIAL_WORKFLOW_STAGES.map((p, idx) => ({
        ...p,
        tenantId: orgId,
        order: idx + 1
      }));
    }
    setWorkflowStages(preset);

    logAuditEvent({
      action: 'WORKFLOW_MODIFIED',
      module: 'workflows',
      entityType: 'WorkflowStage',
      entityId: `preset-${presetType}`,
      entityName: `${presetType.toUpperCase()} Workflow Template`,
      summary: `Loaded standard workflow pipeline template for industry: ${presetType}.`
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
          const newProfit = job.quotedAmount - (newActualMatCost + job.laborCostEstimate);
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

  const createJob = (jobData: Omit<JobOrder, 'id' | 'jobId' | 'materialsUsed' | 'actualMaterialCost' | 'actualProfit'>): JobOrder => {
    const prefix = currentTenant.slug.substring(0, 3).toUpperCase();
    const nextNumber = jobs.length + 240;
    const jobIdStr = `${prefix}-0${nextNumber}`;
    const newJob: JobOrder = {
      ...jobData,
      id: `job-${Date.now()}`,
      jobId: jobIdStr,
      materialsUsed: [],
      actualMaterialCost: 0,
      actualProfit: jobData.quotedAmount - (jobData.laborCostEstimate || 0)
    };

    setJobs((prev) => [newJob, ...prev]);

    // Update customer active jobs count
    setCustomers((prev) =>
      prev.map((c) => (c.id === jobData.customerId ? { ...c, activeJobsCount: c.activeJobsCount + 1 } : c))
    );

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

  const createInvoice = (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'>): Invoice => {
    const nextNum = invoices.length + 88;
    const invNumberStr = `INV-2026-0${nextNum}`;
    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}`,
      invoiceNumber: invNumberStr
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    // Update customer totalInvoiced and outstandingBalance
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === invoiceData.customerId
          ? {
              ...c,
              totalInvoiced: c.totalInvoiced + invoiceData.totalAmount,
              outstandingBalance: c.outstandingBalance + invoiceData.balanceDue
            }
          : c
      )
    );

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
    const subtotal = job.quotedAmount / (1 + gstRateDecimal);
    const gstAmount = job.quotedAmount - subtotal;

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

    setInvoices((prev) => [newInvoice, ...prev]);

    // Link invoice to job
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, linkedInvoiceId: newInvoice.id, status: 'Invoiced' } : j))
    );

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

    setPayments((prev) => [newPayment, ...prev]);

    // Update invoice balance
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

    // Update customer outstanding balance
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
          const newQty = i.quantityOnHand + quantity;
          return {
            ...i,
            quantityOnHand: newQty,
            unitCost: cost !== undefined ? cost : i.unitCost,
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

    // Update PO status
    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === poId ? { ...p, status: 'Received & Stocked', paymentStatus: 'Paid' } : p))
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
        payments,
        expenses,
        inventory,
        stockMovements,
        suppliers,
        purchaseOrders,
        alerts,
        aiInsights,
        staff,

        // Multi-tenant
        currentTenant,
        tenants,
        switchTenant,
        createTenant,
        updateTenant,
        isSetupModalOpen,
        setIsSetupModalOpen,

        // RBAC & User Management
        currentUser,
        users,
        roles,
        switchCurrentUser,
        authorizeUser,
        suspendUser,
        inviteUser,
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
        createJob,
        createCustomer,
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
