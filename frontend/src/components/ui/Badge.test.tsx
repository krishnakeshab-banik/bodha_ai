import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>High demand</Badge>);
    expect(screen.getByText('High demand')).toBeInTheDocument();
  });

  it('defaults to the muted ink colour when no className is given', () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText('Status')).toHaveClass('text-ink-muted');
  });

  it('uses the given className instead of the default when provided', () => {
    render(<Badge className="text-profit-700">Live</Badge>);
    const el = screen.getByText('Live');
    expect(el).toHaveClass('text-profit-700');
    expect(el).not.toHaveClass('text-ink-muted');
  });

  it('renders an icon alongside the label', () => {
    render(<Badge icon={<span data-testid="icon" />}>With icon</Badge>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('With icon')).toBeInTheDocument();
  });
});
