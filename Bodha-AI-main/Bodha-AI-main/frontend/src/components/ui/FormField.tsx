import type { ReactNode } from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/**
 * Wraps a control with its label, hint and inline error, wiring up
 * `aria-describedby` / `aria-invalid` so the error is announced.
 */
export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  const hintId = hint ? id + '-hint' : undefined;
  const errorId = error ? id + '-error' : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="label-text">
        {label}
      </label>

      {hint && (
        <p id={hintId} className="mb-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
