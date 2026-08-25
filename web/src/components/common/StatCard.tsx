import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  subtext?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  variant?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtext,
  trend,
  variant = 'slate',
  onClick
}) => {
  const colorSchemes = {
    blue: {
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
      trendColor: 'text-blue-600'
    },
    emerald: {
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      trendColor: 'text-emerald-600'
    },
    amber: {
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      trendColor: 'text-amber-600'
    },
    purple: {
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
      trendColor: 'text-purple-600'
    },
    rose: {
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
      trendColor: 'text-rose-600'
    },
    slate: {
      iconBg: 'bg-slate-100 text-slate-600 border border-slate-200',
      trendColor: 'text-slate-500'
    }
  };

  const scheme = colorSchemes[variant];

  return (
    <div
      onClick={onClick}
      className={`relative bg-white p-5 rounded-2xl shadow-sm border border-slate-200 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{title}</span>
        <div className={`p-2.5 rounded-xl ${scheme.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-2">
        <div className="text-2xl font-bold text-slate-900 mono-num tracking-tight">{value}</div>
      </div>

      {(subtext || trend) && (
        <div className="mt-2 flex items-center justify-between text-xs">
          {subtext && <span className="text-slate-500 font-normal">{subtext}</span>}
          {trend && (
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                trend.isPositive ? 'text-emerald-600' : 'text-rose-500'
              }`}
            >
              {trend.isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
