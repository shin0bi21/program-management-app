// Scope: verifies confirmation submission, duplicate prevention, and error recovery.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type ConfirmAction, useConfirmModal } from './useConfirmModal';

function deferred() {
  let resolve!: () => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
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
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledOnce();
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
});
