import React, { useState } from 'react';
import {
  FileCheck2,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Shield,
  Clock,
  ArrowUpDown,
  FileText,
  MapPin,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Eye,
  X
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { AuditLogEntry, PermissionModule } from '../../types/erp';
import { Badge } from '../common/Badge';

export const AuditLogView: React.FC = () => {
  const { auditLogs, currentTenant } = useERP();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      searchTerm === '' ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesModule = selectedModule === 'all' || log.module === selectedModule;
    const matchesAction = selectedAction === 'all' || log.action === selectedAction;

    return matchesSearch && matchesModule && matchesAction;
  });

  const getActionBadge = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'USER_AUTHORIZED':
        return <Badge variant="success" size="sm">User Authorized</Badge>;
      case 'USER_INVITED':
        return <Badge variant="blue" size="sm">User Invited</Badge>;
      case 'USER_SUSPENDED':
        return <Badge variant="danger" size="sm">Suspended</Badge>;
      case 'ROLE_UPDATED':
        return <Badge variant="purple" size="sm">Role Modified</Badge>;
      case 'STAGE_TRANSITIONED':
        return <Badge variant="info" size="sm">Stage Changed</Badge>;
      case 'INVOICE_ISSUED':
        return <Badge variant="blue" size="sm">Invoice Issued</Badge>;
      case 'PAYMENT_RECORDED':
        return <Badge variant="success" size="sm">Payment Logged</Badge>;
      case 'STOCK_ADJUSTED':
        return <Badge variant="warning" size="sm">Stock Movement</Badge>;
      case 'ORG_CONFIG_SAVED':
        return <Badge variant="blue" size="sm">Tenant Config</Badge>;
      case 'WORKFLOW_MODIFIED':
        return <Badge variant="purple" size="sm">Workflow Edit</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{action}</Badge>;
    }
  };

  const handleExportCSV = () => {
    const headers = 'ID,Timestamp,User,Email,Role,Action,Module,Entity,Summary,IP Address\n';
    const rows = filteredLogs
      .map(
        (l) =>
          `"${l.id}","${l.timestamp}","${l.userName}","${l.userEmail}","${l.userRole}","${l.action}","${l.module}","${l.entityName}","${l.summary.replace(/"/g, '""')}","${l.ipAddress || ''}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StarqERP_AuditLogs_${currentTenant.slug}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Activity & Audit Trail
                </h1>
                <Badge variant="blue" size="sm">
                  Owner's Evidence
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Immutable, real-time audit ledger of all organizational actions, user authorizations, stage transitions, and financial events.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Audit Ledger</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by staff member, invoice #, work order, customer or summary..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Modules</option>
              <option value="jobs">Jobs & Stages</option>
              <option value="invoices">Invoices</option>
              <option value="payments">Payments</option>
              <option value="inventory">Inventory</option>
              <option value="purchasing">Purchasing</option>
              <option value="users">User Authorizations</option>
              <option value="roles">Roles & Security</option>
              <option value="workflows">Workflows</option>
              <option value="settings">Organization Config</option>
            </select>

            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Actions</option>
              <option value="USER_AUTHORIZED">User Authorized</option>
              <option value="STAGE_TRANSITIONED">Stage Transitioned</option>
              <option value="INVOICE_ISSUED">Invoice Issued</option>
              <option value="PAYMENT_RECORDED">Payment Recorded</option>
              <option value="STOCK_ADJUSTED">Stock Movement</option>
              <option value="ROLE_UPDATED">Role Updated</option>
              <option value="ORG_CONFIG_SAVED">Org Config Saved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-bold">Timestamp & Location</th>
                <th className="py-3 px-4 font-bold">Actor</th>
                <th className="py-3 px-3 font-bold">Event Type</th>
                <th className="py-3 px-3 font-bold">Target Entity</th>
                <th className="py-3 px-4 font-bold">Audit Narrative & Summary</th>
                <th className="py-3 px-3 font-bold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No activity audit logs matching your current filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-slate-900 dark:text-slate-100 font-semibold text-[11px]">
                        {log.timestamp}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        <span>{log.location || `${currentTenant.island} Office`}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{log.userName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {log.userRole}
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {log.entityName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.entityType}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-700 dark:text-slate-300 font-medium max-w-md line-clamp-2">
                        {log.summary}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        title="View Detailed Snapshot"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Audit Record Verification
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    ID: {selectedLog.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">
                  Event Summary
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLog.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Actor / User</span>
                  <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedLog.userName}
                  </div>
                  <div className="text-[11px] text-slate-500">{selectedLog.userEmail}</div>
                  <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                    Role: {selectedLog.userRole}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Audit Stamp</span>
                  <div className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedLog.timestamp}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{selectedLog.location || `${currentTenant.island} Terminal`}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Network & Terminal Origin</span>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400">IP Address:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {selectedLog.ipAddress || '123.231.104.18 (Dhiraagu IP)'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400">Target Tenant:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {currentTenant.name}
                  </span>
                </div>
              </div>

              {(selectedLog.previousValue || selectedLog.newValue) && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">State Diff Snapshot</span>
                  {selectedLog.previousValue && (
                    <div className="text-[11px] p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 font-mono">
                      - {selectedLog.previousValue}
                    </div>
                  )}
                  {selectedLog.newValue && (
                    <div className="text-[11px] p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-mono">
                      + {selectedLog.newValue}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
              >
                Close Audit Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
