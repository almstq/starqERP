import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'danger' | 'primary' | 'secondary' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'filled',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  className = '',
  style,
  ...props
}) => {
  const sizeClasses = {
    xs: 'h-7 px-2.5 text-[11px] gap-1.5 rounded-[var(--md-sys-shape-corner-full)]',
    sm: 'h-8 px-3 text-xs gap-1.5 rounded-[var(--md-sys-shape-corner-full)]',
    md: 'h-9 px-4 text-xs font-medium gap-2 rounded-[var(--md-sys-shape-corner-full)] min-h-[36px]',
    lg: 'h-11 px-6 text-sm font-medium gap-2.5 rounded-[var(--md-sys-shape-corner-full)] min-h-[44px]',
  }[size];

  // Material 3 semantic variant styling
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'filled':
      case 'primary':
        return {
          backgroundColor: 'var(--md-sys-color-primary)',
          color: 'var(--md-sys-color-on-primary)',
          border: '1px solid transparent',
          fontWeight: 600,
        };
      case 'tonal':
      case 'secondary':
        return {
          backgroundColor: 'var(--md-sys-color-secondary-container)',
          color: 'var(--md-sys-color-on-secondary-container)',
          border: '1px solid transparent',
          fontWeight: 500,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          color: 'var(--md-sys-color-primary)',
          border: '1px solid var(--md-sys-color-outline)',
          fontWeight: 500,
        };
      case 'text':
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--md-sys-color-on-surface-variant)',
          border: '1px solid transparent',
          fontWeight: 500,
        };
      case 'danger':
        return {
          backgroundColor: 'var(--md-sys-color-error)',
          color: 'var(--md-sys-color-on-error)',
          border: '1px solid transparent',
          fontWeight: 600,
        };
      default:
        return {
          backgroundColor: 'var(--md-sys-color-primary)',
          color: 'var(--md-sys-color-on-primary)',
        };
    }
  };

  return (
    <button
      disabled={disabled || loading}
      style={{ ...getVariantStyles(), ...style }}
      className={`inline-flex items-center justify-center transition-all cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] ${sizeClasses} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
};
