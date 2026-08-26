import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  Landmark,
  Users,
  GitBranch,
  Save,
  CheckCircle2,
  Lock,
  Globe,
  Plus,
  Sparkles,
  MapPin,
  LifeBuoy
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { GstRegistrationStatus } from '../../types/erp';
import { Badge } from '../common/Badge';
import { RolesPermissionsTab } from './RolesPermissionsTab';
import { UsersManagementTab } from './UsersManagementTab';
import { WorkflowsConfigTab } from './WorkflowsConfigTab';
import { SupportTab } from './SupportTab';

type SettingsSubTab = 'profile' | 'roles' | 'users' | 'workflows' | 'support';

export const SettingsView: React.FC = () => {
  const { currentTenant, updateTenant, setIsSetupModalOpen } = useERP();
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('profile');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Local state for current tenant editing
  const [name, setName] = useState(currentTenant.name);
  const [legalName, setLegalName] = useState(currentTenant.legalName);
  const [tinNumber, setTinNumber] = useState(currentTenant.tinNumber);
  const [gstStatus, setGstStatus] = useState<GstRegistrationStatus>(currentTenant.gstStatus || 'not_registered');
  const [gstRate, setGstRate] = useState(currentTenant.gstRate || 8);
  const [bmlAccount, setBmlAccount] = useState(currentTenant.bmlAccount || '');
  const [address, setAddress] = useState(currentTenant.address);
  const [phone, setPhone] = useState(currentTenant.phone);
  const [email, setEmail] = useState(currentTenant.email);
  const [island, setIsland] = useState(currentTenant.island);

  // Synchronize local form state if currentTenant changes
  React.useEffect(() => {
    setName(currentTenant.name);
    setLegalName(currentTenant.legalName);
    setTinNumber(currentTenant.tinNumber);
    setGstStatus(currentTenant.gstStatus || 'not_registered');
    setGstRate(currentTenant.gstRate || 8);
    setBmlAccount(currentTenant.bmlAccount || '');
    setAddress(currentTenant.address);
    setPhone(currentTenant.phone);
    setEmail(currentTenant.email);
    setIsland(currentTenant.island);
  }, [currentTenant]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateTenant({
      name,
      legalName,
      tinNumber,
      gstStatus,
      gstRate,
      bmlAccount,
      address,
      phone,
      email,
      island
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Tenant & System Settings
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold">
              {currentTenant.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure multi-tenant business identity, MIRA GST compliance, custom role capabilities, and shop floor workflows.
          </p>
        </div>

        <button
          onClick={() => setIsSetupModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-blue-600" />
          <span>New Client Onboarding</span>
        </button>
      </div>

      {/* Settings Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'profile', label: 'Company Profile & Tax', icon: Building2 },
          { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
          { id: 'users', label: 'Users & Authorizations', icon: Users },
          { id: 'workflows', label: 'Configurable Workflows', icon: GitBranch },
          { id: 'support', label: 'Support & Escalation', icon: LifeBuoy }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SettingsSubTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUBTAB CONTENT */}
      {activeSubTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6 animate-in fade-in">
          {savedSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Organisation Settings Saved & Audited Successfully!</span>
            </div>
          )}

          {/* Business Profile */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Organisation Identity & Invoicing Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tenant Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Registered Legal Entity Name
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SME Industry Archetype
                </label>
                <input
                  type="text"
                  readOnly
                  value={currentTenant.industry}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Registered Island
                </label>
                <select
                  value={island}
                  onChange={(e) => setIsland(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="Male'">Male' (Capital)</option>
                  <option value="Hulhumale'">Hulhumale' (Phase 1 / Phase 2)</option>
                  <option value="Thilafushi">Thilafushi Industrial Island</option>
                  <option value="Villimale'">Villimale'</option>
                  <option value="Addu City">Addu City</option>
                  <option value="Fuvahmulah City">Fuvahmulah City</option>
                  <option value="Kulhudhuffushi City">Kulhudhuffushi City</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Physical Registered Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Contact Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Accounts & Tax Inquiries Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Tax & Banking Localization */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Landmark className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                MIRA Tax Compliance & Banking Settlement
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  MIRA GST Statutory Registration Status
                </label>
                <select
                  value={gstStatus}
                  onChange={(e) => setGstStatus(e.target.value as GstRegistrationStatus)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-bold"
                >
                  <option value="not_registered">Not Registered with MIRA (0% statutory filing / exempt)</option>
                  <option value="registered">Registered with MIRA (Statutory GST filing enabled)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  TIN entry alone does not automatically make the business registered; explicit registration status controls the MIRA GST statutory schedule and Reports view.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  MIRA GST TIN Registration Number
                </label>
                <input
                  type="text"
                  value={tinNumber}
                  onChange={(e) => setTinNumber(e.target.value)}
                  placeholder="e.g. 1004829GST001"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Applicable GST Rate (%)
                </label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-bold"
                >
                  <option value={8}>8% General Goods & Services Tax (GGST)</option>
                  <option value={16}>16% Tourism Sector GST (TGST)</option>
                  <option value={0}>0% Zero-rated / Medical Healthcare Exempt</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Settlement Bank Account
                </label>
                <input
                  type="text"
                  value={bmlAccount}
                  onChange={(e) => setBmlAccount(e.target.value)}
                  placeholder="e.g. 7730000189201 (BML MVR) or 9901004829101 (MIB)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Tenant Profile</span>
            </button>
          </div>
        </form>
      )}

      {activeSubTab === 'roles' && <RolesPermissionsTab />}

      {activeSubTab === 'users' && <UsersManagementTab />}

      {activeSubTab === 'workflows' && <WorkflowsConfigTab />}
      
      {activeSubTab === 'support' && <SupportTab />}
    </div>
  );
};
