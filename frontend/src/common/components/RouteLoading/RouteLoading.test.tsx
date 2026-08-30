// Owns the accessible status exposed while a route bundle loads.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../LoadingSpinner/LoadingSpinner', () => ({
  default: ({ size }: { size?: string }) => <span data-testid="route-spinner" data-size={size} />,
}));

import RouteLoading from './RouteLoading';

describe('RouteLoading', () => {
  it('announces page loading and requests the large shared spinner', () => {
    render(<RouteLoading />);

    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveClass('route-loading');
    expect(screen.getByTestId('route-spinner')).toHaveAttribute('data-size', 'lg');
  });
});
