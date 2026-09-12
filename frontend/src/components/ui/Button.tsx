import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '../../utils/format';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#0d6b4c] text-white hover:bg-[#0a5540] active:bg-[#0c3d2e] disabled:bg-[#73b59a]',
  secondary:
    'bg-transparent text-ink ring-1 ring-inset ring-rule hover:bg-[#faf8f3] active:bg-rule/40 disabled:text-ink-muted',
  ghost: 'text-brand-700 hover:bg-brand-50 active:bg-brand-100 disabled:text-ink-muted',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
}
