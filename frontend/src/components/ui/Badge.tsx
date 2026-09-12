import type { ReactNode } from 'react';

import { cx } from '../../utils/format';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

/** Compact status word. Reserved for real status, not decoration. */
export function Badge({ children, className, icon }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.1em]',
        className ?? 'text-ink-muted',
      )}
    >
      {icon}
      {children}
    </span>
  );
}
