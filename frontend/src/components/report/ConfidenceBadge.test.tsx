import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '../../i18n';
import { ConfidenceBadge } from './ConfidenceBadge';

describe('ConfidenceBadge', () => {
  it('marks High and Low as visually distinct', () => {
    const { rerender } = render(
      <ConfidenceBadge
        confidence={{
          level: 'High',
          listingCount: 18,
          titleMatch: 'exact',
          freshness: 'live',
        }}
      />,
    );
    const high = screen.getByTestId('data-confidence');
    expect(high).toHaveAttribute('data-confidence', 'High');
    expect(high.className).toMatch(/profit/);
    expect(high.className).not.toMatch(/border-l-2/);

    rerender(
      <ConfidenceBadge
        confidence={{
          level: 'Low',
          listingCount: 2,
          titleMatch: 'category',
          freshness: 'cached',
        }}
      />,
    );
    const low = screen.getByTestId('data-confidence');
    expect(low).toHaveAttribute('data-confidence', 'Low');
    expect(low.className).toMatch(/danger/);
    expect(low.className).toMatch(/border-l-2/);
    expect(low.textContent).toMatch(/cautiously/i);
  });
});
