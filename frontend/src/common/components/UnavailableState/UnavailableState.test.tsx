// Scope: verifies the shared unavailable fallback and optional retry action.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import UnavailableState from './UnavailableState';

describe('UnavailableState', () => {
  it('renders a neutral fallback and delegates retry without announcing another alert', () => {
    const onRetry = vi.fn();
    render(<UnavailableState title="Tasks unavailable" onRetry={onRetry} />);

    expect(screen.getByText('Tasks unavailable')).toBeInTheDocument();
    expect(screen.getByText('Refresh to try loading this content again.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
