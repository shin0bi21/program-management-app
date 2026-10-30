// Scope: verifies shared table-body state rows and visible-column spanning.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TableBody from './TableBody';

describe('TableBody', () => {
  it('spans the currently visible TanStack columns while loading', () => {
    render(<table><TableBody
      rows={[]}
      visibleColumnCount={3}
      data={[]}
      loading
      refreshing={false}
      emptyMessage="No rows"
      keyExtractor={() => ''}
      tabbableIndex={0}
      onNavigate={vi.fn()}
    /></table>);

    const loadingCell = screen.getByRole('status', { name: 'Loading rows' }).closest('td');
    expect(loadingCell).toHaveAttribute('colspan', '3');
  });
});
