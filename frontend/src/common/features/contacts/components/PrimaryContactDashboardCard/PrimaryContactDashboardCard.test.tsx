import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrimaryContactDashboardCard from './PrimaryContactDashboardCard';

describe('PrimaryContactDashboardCard', () => {
  it('distinguishes no row selection from a selected row with no contact', () => {
    const { rerender } = render(<PrimaryContactDashboardCard contact={null} selected={false} />);
    expect(screen.getByText('Select a row to view the primary contact.')).toBeInTheDocument();

    rerender(<PrimaryContactDashboardCard contact={null} selected />);
    expect(screen.getByText('No primary contact recorded.')).toBeInTheDocument();
  });
});
