import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'blue';
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  size = 'md',
  className = '',
  dot = false
}) => {
  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const dotStyles = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500 animate-pulse',
    danger: 'bg-rose-500 animate-ping',
    info: 'bg-blue-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    neutral: 'bg-slate-400'
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-semibold tracking-tight',
    md: 'text-xs px-2.5 py-1 font-semibold tracking-tight'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap leading-none shadow-xs ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles[variant]}`} />}
      <span>{children}</span>
    </span>
  );
};
