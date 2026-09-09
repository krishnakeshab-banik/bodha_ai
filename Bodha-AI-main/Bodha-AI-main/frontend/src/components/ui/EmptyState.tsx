import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/** Shown wherever a list has no rows yet - never a blank screen. */
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-4 border-t border-rule py-16">
      {icon ? <div className="text-brand-700">{icon}</div> : null}

      <div className="max-w-md space-y-1.5">
        <h3 className="font-display text-lg font-medium text-ink">{title}</h3>
        <p className="text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>

      {action}
    </div>
  );
}
