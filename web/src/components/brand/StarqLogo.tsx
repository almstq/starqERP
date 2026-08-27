import React from 'react';

export interface StarqLogomarkProps {
  size?: number;
  className?: string;
}

/**
 * Authoritative Canonical Starq Logomark SVG
 * Sourced directly from brand/v1.0/starqERP_brand_kit/logos/starq_logomark_light.svg
 */
export const StarqLogomark: React.FC<StarqLogomarkProps> = ({ size = 20, className = '' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10 18H34C41 18 46 23 46 30V34" />
      <path d="M10 32H38" />
      <path d="M10 46H30C38 46 43 42 46 36L56 54" />
    </svg>
  );
};

export interface StarqBrandLockupProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showTag?: boolean;
}

/**
 * Authoritative Starq Brand Lockup: Canonical Logomark + "starq" + "ERP"
 */
export const StarqBrandLockup: React.FC<StarqBrandLockupProps> = ({
  size = 'md',
  className = '',
  showTag = true,
}) => {
  const iconSizes = { sm: 16, md: 18, lg: 24 };
  const textSizes = {
    sm: 'text-sm',
    md: 'text-base font-bold',
    lg: 'text-xl font-bold',
  };
  const badgeSizes = {
    sm: 'text-[9px] px-1 py-0.2',
    md: 'text-[10px] px-1.5 py-0.5',
    lg: 'text-xs px-2 py-0.5',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none min-w-0 ${className}`}>
      <div
        className="flex items-center justify-center rounded-[var(--md-sys-shape-corner-small)] shrink-0 transition-transform"
        style={{
          backgroundColor: 'var(--md-sys-color-primary)',
          color: 'var(--md-sys-color-on-primary)',
          padding: size === 'sm' ? '5px' : size === 'lg' ? '8px' : '6px',
        }}
      >
        <StarqLogomark size={iconSizes[size]} />
      </div>

      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`tracking-tight text-[var(--md-sys-color-on-surface)] ${textSizes[size]}`}
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          starq
        </span>

        {showTag && (
          <span
            className={`font-mono font-bold uppercase rounded-[var(--md-sys-shape-corner-extra-small)] tracking-wider shrink-0 ${badgeSizes[size]}`}
            style={{
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
            }}
          >
            ERP
          </span>
        )}
      </div>
    </div>
  );
};
