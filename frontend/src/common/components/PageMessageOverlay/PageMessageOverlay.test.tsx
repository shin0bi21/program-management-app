// Scope: verifies page-level error presentation, actions, and dismissal behavior.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PageMessageOverlay from './PageMessageOverlay';

describe('PageMessageOverlay', () => {
  it('renders nothing when no errors are present', () => {
    render(<PageMessageOverlay messages={[null, undefined, false, '']} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('groups multiple unique errors in their supplied order', () => {
    render(<PageMessageOverlay messages={[
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
    render(<PageMessageOverlay messages={[{
      message: 'Unable to load calendar.',
      details: 'The selected calendar range could not be loaded.',
      action: { label: 'Retry', onClick: retry },
    }]} />);

    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText('The selected calendar range could not be loaded.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss page messages' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reappears when the active error messages change', () => {
    const view = render(<PageMessageOverlay messages={['Unable to load tasks.']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss page messages' }));

    view.rerender(<PageMessageOverlay messages={['Unable to load preferences.']} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load preferences.');
  });
});

it('presents a warning with a disabled pending action', () => {
  const refresh = vi.fn();
  const warning = {
    message: 'This table’s data is out of order.', severity: 'warning' as const,
    action: { label: 'Refresh', onClick: refresh, disabled: true },
  };
  const view = render(<PageMessageOverlay messages={[warning]} />);

  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(refresh).not.toHaveBeenCalled();

  view.rerender(<PageMessageOverlay messages={[{ ...warning, action: { ...warning.action, disabled: false } }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(refresh).toHaveBeenCalledOnce();
});

it('flattens grouped messages and deduplicates by severity and message', () => {
  render(<PageMessageOverlay messages={[
    'Unable to load records.',
    [{ message: 'Unable to load records.' }, { message: 'Unable to load records.', severity: 'warning' }],
  ]} />);

  const items = within(screen.getByRole('alert')).getAllByRole('listitem');
  expect(items).toHaveLength(2);
});

it('resets dismissal after all messages clear and when severity changes', () => {
  const view = render(<PageMessageOverlay messages={['Check the view.']} />);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss page messages' }));

  view.rerender(<PageMessageOverlay messages={[{ message: 'Check the view.', severity: 'warning' }]} />);
  expect(screen.getByRole('status')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss page messages' }));
  view.rerender(<PageMessageOverlay messages={[]} />);
  view.rerender(<PageMessageOverlay messages={[{ message: 'Check the view.', severity: 'warning' }]} />);
  expect(screen.getByRole('status')).toBeVisible();
});
