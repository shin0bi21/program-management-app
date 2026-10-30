import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ConfirmAction } from '../types';
import { useConfirmModal } from './useConfirmModal';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function ConfirmHarness({
  action,
  onClose,
}: {
  action: ConfirmAction | null;
  onClose: () => void;
}) {
  const confirmation = useConfirmModal({ action, onClose });

  return <>
    <span data-testid="status">{confirmation.status}</span>
    <span data-testid="message">{confirmation.statusMessage}</span>
    {confirmation.footer}
  </>;
}

describe('useConfirmModal', () => {
  it('runs only one confirmation for same-tick clicks', async () => {
    const pending = deferred();
    const onConfirm = vi.fn(() => pending.promise);
    render(<ConfirmHarness
      action={{ title: 'Delete', message: 'Delete?', onConfirm }}
      onClose={vi.fn()}
    />);

    const confirm = screen.getByRole('button', { name: 'Confirm' });
    // Keep both clicks before React commits the disabled button state.
    act(() => {
      fireEvent.click(confirm);
      expect(confirm).toBeEnabled();
      fireEvent.click(confirm);
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirm).toBeDisabled();
    pending.resolve();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('idle'));
  });

  it('surfaces the current action failure and allows retry', async () => {
    const onConfirm = vi.fn()
      .mockRejectedValueOnce(new Error('Unable to delete'))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(<ConfirmHarness
      action={{ title: 'Delete', message: 'Delete?', onConfirm }}
      onClose={onClose}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Unable to delete')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('exposes success feedback for the modal-owned delayed close', async () => {
    const onClose = vi.fn();
    render(<ConfirmHarness
      action={{
        title: 'Delete',
        message: 'Delete?',
        successMessage: 'Deleted successfully',
        onConfirm: vi.fn().mockResolvedValue(undefined),
      }}
      onClose={onClose}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('success'));
    expect(screen.getByTestId('message')).toHaveTextContent('Deleted successfully');
    expect(onClose).not.toHaveBeenCalled();
  });
});
