import React from 'react';
import { ShieldAlert, UserCheck, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const PendingApprovalBanner: React.FC = () => {
  const { currentUser, switchCurrentUser, authorizeUser } = useERP();

  if (currentUser.status !== 'Pending Approval') return null;

  return (
    <div className="mb-6 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-amber-900 dark:text-amber-100">
                Awaiting Administrator Authorization
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wide">
                Pending Approval
              </span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1 max-w-2xl">
              Hello <strong className="font-semibold">{currentUser.name}</strong> ({currentUser.email}). You have signed into StarqERP, but in this multi-tenant SaaS environment, new users land in <strong>PENDING</strong> status until an authorized administrator grants your role and module permissions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            onClick={() => authorizeUser(currentUser.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Self-Authorize (Demo)</span>
          </button>
          <button
            onClick={() => switchCurrentUser('user-1')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <span>Switch to Admin (Ali)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
