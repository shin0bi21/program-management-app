// Scope: verifies the standard confirmation dialog presentation and submission wiring.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ConfirmModal from './ConfirmModal';

describe('ConfirmModal', () => {
  it('renders nothing without an action', () => {
    render(<ConfirmModal action={null} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the action and closes after a successful confirmation', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<ConfirmModal
      action={{
        title: 'Delete Task',
        message: 'Delete this task?',
        confirmVariant: 'danger',
        onConfirm,
      }}
      onClose={onClose}
    />);

    expect(screen.getByRole('dialog', { name: 'Delete Task' })).toBeInTheDocument();
    expect(screen.getByText('Delete this task?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('shows confirmation errors without closing', async () => {
    const onClose = vi.fn();

    render(<ConfirmModal
      action={{
        title: 'Delete Task',
        message: 'Delete this task?',
        onConfirm: vi.fn().mockRejectedValue(new Error('Unable to delete task')),
      }}
      onClose={onClose}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to delete task');
    expect(onClose).not.toHaveBeenCalled();
  });
});
