import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  icon,
  className = '',
  id,
  style,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[11px] font-medium tracking-wide"
          style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div
            className="absolute left-3 pointer-events-none"
            style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            color: 'var(--md-sys-color-on-surface)',
            borderColor: error ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-outline-variant)',
            borderRadius: 'var(--md-sys-shape-corner-small)',
            ...style,
          }}
          className={`w-full h-9 px-3 text-xs border outline-none transition-colors focus:border-[var(--md-sys-color-primary)] focus:ring-1 focus:ring-[var(--md-sys-color-primary)] ${icon ? 'pl-9' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[11px] font-medium" style={{ color: 'var(--md-sys-color-error)' }} role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-[11px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
