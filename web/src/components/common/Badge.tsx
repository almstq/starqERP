import React from 'react';
import { Badge as CanonicalBadge, BadgeVariant } from '../ui/Badge';

interface LegacyBadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'blue' | 'positive' | 'destructive' | 'accent';
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<LegacyBadgeProps> = ({
  variant = 'neutral',
  children,
  size = 'md',
  className = '',
  dot = false,
}) => {
  const mapVariant = (v: string): BadgeVariant => {
    switch (v) {
      case 'success':
      case 'positive':
        return 'positive';
      case 'danger':
      case 'destructive':
        return 'destructive';
      case 'warning':
        return 'warning';
      case 'info':
      case 'blue':
      case 'purple':
        return 'info';
      case 'accent':
        return 'accent';
      default:
        return 'neutral';
    }
  };

  return (
    <CanonicalBadge
      variant={mapVariant(variant)}
      size={size}
      dot={dot}
      className={className}
    >
      {children}
    </CanonicalBadge>
  );
};
