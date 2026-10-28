import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import StatusBadge from './StatusBadge';

it.each(['upcoming', 'active', 'overdue', 'completed', 'cancelled'] as const)(
  'renders the supplied label with the %s appearance', status => {
    render(<StatusBadge status={status} label="Status label" />);
    expect(screen.getByText('Status label')).toHaveClass('status-label', `status-label--${status}`);
  },
);
