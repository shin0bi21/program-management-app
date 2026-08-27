// Owns IntakeInformationDashboardCard rendered behavior and owner wiring.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import IntakeInformationDashboardCard from './IntakeInformationDashboardCard';

describe('IntakeInformationDashboardCard', () => {
  it('distinguishes no selection from a selected lead without intake information', () => {
    const { rerender } = render(<IntakeInformationDashboardCard selected={false} />);
    expect(screen.getByText('Select a lead to view intake information.')).toBeInTheDocument();

    rerender(<IntakeInformationDashboardCard selected notes="   " />);
    expect(screen.getByText('No intake information recorded.')).toBeInTheDocument();
  });

  it('shows the submitted intake information', () => {
    render(<IntakeInformationDashboardCard selected notes="Needs evening contact." />);
    expect(screen.getByText('Needs evening contact.')).toBeInTheDocument();
  });
});
