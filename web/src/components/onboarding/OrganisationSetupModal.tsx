import React, { useState } from 'react';
import {
  Building2,
  Globe,
  Receipt,
  Landmark,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Flame,
  Ship,
  Activity,
  Boxes,
  HelpCircle,
  X
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { IndustryType } from '../../types/erp';

interface OrganisationSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrganisationSetupModal: React.FC<OrganisationSetupModalProps> = ({
  isOpen,
  onClose
}) => {
  const { createTenant, tenants } = useERP();
  const [step, setStep] = useState<number>(1);

  // Form state
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [industry, setIndustry] = useState<IndustryType>('Automotive & Body Repair');
  const [currency, setCurrency] = useState<'MVR' | 'USD'>('MVR');
  const [tinNumber, setTinNumber] = useState('');
  const [gstRate, setGstRate] = useState<number>(8);
  const [financialYearStart, setFinancialYearStart] = useState('01-01');
  const [financialYearEnd, setFinancialYearEnd] = useState('12-31');
  const [phone, setPhone] = useState('+960 ');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [island, setIsland] = useState("Male'");
  const [atoll, setAtoll] = useState('Kaafu Atoll');
  const [bmlAccount, setBmlAccount] = useState('');
  const [mibAccount, setMibAccount] = useState('');

  if (!isOpen) return null;

  const handleSelectIndustry = (type: IndustryType) => {
    setIndustry(type);
    if (!name) {
      if (type === 'Automotive & Body Repair') setName('Velocity Motors & Spray Garage');
      if (type === 'Marine & Boatyard') setName('BlueWave Marine Slipway');
      if (type === 'Medical Clinic & Diagnostics') setName('Apex Polyclinic & Care');
      if (type === 'Retail & Wholesale Trading') setName('Islanders Hardware & Mart');
    }
  };

  const handleCompleteSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const symbol = currency === 'MVR' ? 'Rf' : '$';

    createTenant({
      name,
      slug,
      legalName: legalName || `${name} Pvt Ltd`,
      industry,
      currency,
      currencySymbol: symbol,
      // No invented TIN. A blank field means "not registered", and the tenant is
      // recorded as such — it does not mean "make one up". The previous fallback
      // gave every tenant that skipped the field a fabricated MIRA TIN, which
      // then appeared on their invoices as fact. DEC-073 §10.
      tinNumber,
      gstStatus: tinNumber ? 'registered' : 'not_registered',
      gstRate,
      financialYearStart,
      financialYearEnd,
      phone: phone.trim() !== '+960' ? phone : '',
      email,
      address,
      island: island || "Male'",
      atoll: atoll || 'Kaafu Atoll',
      bmlAccount: bmlAccount ? (bmlAccount.includes('(') ? bmlAccount : `${bmlAccount} (BML)`) : '',
      mibAccount: mibAccount ? (mibAccount.includes('(') ? mibAccount : `${mibAccount} (MIB)`) : undefined,
      themeColor: industry === 'Medical Clinic & Diagnostics' ? '#059669' : industry === 'Marine & Boatyard' ? '#0284c7' : '#2563eb'
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all">
        {/* Top Gradient Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-6 sm:px-8 py-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider">
                  Multi-Tenant SaaS Onboarding
                </span>
                <span className="text-xs text-blue-100">Step {step} of 3</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5 text-white">
                Set Up New Maldivian Organisation
              </h2>
            </div>
          </div>

          {/* Progress step indicators */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                step >= 1 ? 'bg-white' : 'bg-white/30'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                step >= 2 ? 'bg-white' : 'bg-white/30'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                step >= 3 ? 'bg-white' : 'bg-white/30'
              }`}
            />
          </div>
        </div>

        {/* Modal Form Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Business Activity & Organization Identity
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select your SME industry archetype. StarqERP will automatically configure tailored workflow stages and inventory categories.
                </p>
              </div>

              {/* Industry Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'Automotive & Body Repair',
                    title: 'Automotive & Body Repair',
                    desc: 'Work orders, paint booth cycles, vehicle plates, spray materials, body prep.',
                    icon: Flame,
                    color: 'blue'
                  },
                  {
                    id: 'Marine & Boatyard',
                    title: 'Marine & Speedboat Yard',
                    desc: 'Slipway hauling, hull antifouling, fiberglass layup, marine outboards.',
                    icon: Ship,
                    color: 'cyan'
                  },
                  {
                    id: 'Medical Clinic & Diagnostics',
                    title: 'Medical Clinic & Diagnostics',
                    desc: 'Patient vitals triage, physician consults, lab diagnostics, pharmacy billing.',
                    icon: Activity,
                    color: 'emerald'
                  },
                  {
                    id: 'Retail & Wholesale Trading',
                    title: 'Retail & Wholesale Trading',
                    desc: 'POS transactions, multi-store stock, purchase orders, vendor payables.',
                    icon: Boxes,
                    color: 'amber'
                  }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = industry === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectIndustry(item.id as IndustryType)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-500 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {item.title}
                          </span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-10">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Business Name Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Organization Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Velocity Motors & Spray Garage"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
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
                    placeholder="e.g. Velocity Motors Maldives Pvt Ltd"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Tax Registration & Fiscal Calendar
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure Maldives Inland Revenue Authority (MIRA) GST registration and financial reporting periods.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    MIRA GST TIN Registration Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={tinNumber}
                    onChange={(e) => setTinNumber(e.target.value)}
                    placeholder="e.g. 1099882GST501"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-mono font-bold focus:outline-none focus:border-blue-500 text-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Printed on all formal Maldives Tax Invoices
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Applicable GST Rate (%)
                  </label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value={8}>8% Standard General GST (GGST)</option>
                    <option value={16}>16% Tourism Sector GST (TGST)</option>
                    <option value={0}>0% Zero-rated / Medical Exempt</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Operating Base Currency
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrency('MVR')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        currency === 'MVR'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      MVR (Maldivian Rufiyaa - Rf)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        currency === 'USD'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      USD ($ United States Dollar)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Financial Year Cycle
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value="January 1st"
                      readOnly
                      className="w-1/2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="text"
                      value="December 31st"
                      readOnly
                      className="w-1/2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Location & Banking Reconciliation Setup
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Set registered island branch details and Bank of Maldives (BML) transfer settlement accounts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Registered Island / City
                  </label>
                  <select
                    value={island}
                    onChange={(e) => setIsland(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
                  >
                    <option value="Male'">Male' (Capital)</option>
                    <option value="Hulhumale'">Hulhumale' (Phase 1 / Phase 2)</option>
                    <option value="Thilafushi">Thilafushi Industrial Island</option>
                    <option value="Villimale'">Villimale'</option>
                    <option value="Addu City">Addu City (Hithadhoo / Feydhoo)</option>
                    <option value="Fuvahmulah City">Fuvahmulah City</option>
                    <option value="Kulhudhuffushi City">Kulhudhuffushi City</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone & Accounts Email
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+960 778-0000"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@sme.mv"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bank of Maldives (BML) Account for Payment Slips
                  </label>
                  <input
                    type="text"
                    value={bmlAccount}
                    onChange={(e) => setBmlAccount(e.target.value)}
                    placeholder="e.g. 7730000189201 (BML MVR Corporate Account)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Clients will see this account number on invoice headers and QR payment slips
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !name) {
                    setName('Apex Auto & Marine Works');
                  }
                  setStep((s) => s + 1);
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteSetup}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Launch StarqERP Workspace</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
