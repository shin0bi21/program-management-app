import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReAuthProvider } from './ReAuthProvider';
import { reAuthCoordinator } from './reAuthCoordinator';
import { useReAuth } from './reAuthContext';

vi.mock('../../common/components/ReLoginModal/ReLoginModal', () => ({
  default: ({ isOpen, onReAuthenticated }: {
    isOpen: boolean;
    onReAuthenticated: () => void;
  }) => isOpen ? <button onClick={onReAuthenticated}>Complete re-auth</button> : null,
}));

function ReAuthProbe() {
  const { status } = useReAuth();
  return <p>Re-auth status: {status}</p>;
}

describe('ReAuthProvider', () => {
  it('shows the re-login UI and resolves the shared workflow', async () => {
    render(
      <ReAuthProvider>
        <ReAuthProbe />
      </ReAuthProvider>,
    );

    let pending!: Promise<void>;
    act(() => {
      pending = reAuthCoordinator.requestReAuth();
    });

    expect(screen.getByText('Re-auth status: prompting')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete re-auth' }));

    await expect(pending).resolves.toBeUndefined();
    expect(screen.getByText('Re-auth status: idle')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete re-auth' })).not.toBeInTheDocument();
  });
});
