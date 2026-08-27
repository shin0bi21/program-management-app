// Scope: verifies page-level error presentation, actions, and dismissal behavior.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PageErrorOverlay from './PageErrorOverlay';

describe('PageErrorOverlay', () => {
  it('renders nothing when no errors are present', () => {
    render(<PageErrorOverlay errors={[null, undefined, false, '']} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('groups multiple unique errors in their supplied order', () => {
    render(<PageErrorOverlay errors={[
      'Unable to load tasks.',
      'Unable to load preferences.',
      'Unable to load tasks.',
    ]} />);

    expect(within(screen.getByRole('alert')).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'Unable to load tasks.',
      'Unable to load preferences.',
    ]);
  });

  it('runs an error action and supports dismissal', () => {
    const retry = vi.fn();
    render(<PageErrorOverlay errors={[{
      message: 'Unable to load calendar.',
      details: 'The selected calendar range could not be loaded.',
      action: { label: 'Retry', onClick: retry },
    }]} />);

    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText('The selected calendar range could not be loaded.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss page errors' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reappears when the active error messages change', () => {
    const view = render(<PageErrorOverlay errors={['Unable to load tasks.']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss page errors' }));

    view.rerender(<PageErrorOverlay errors={['Unable to load preferences.']} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load preferences.');
  });
});
