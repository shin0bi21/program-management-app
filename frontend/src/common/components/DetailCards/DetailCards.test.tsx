import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttendanceCard, PrimaryContactCard } from './DetailCards';

describe('DetailCards', () => {
  it('distinguishes no row selection from a selected row with no contact', () => {
    const { rerender } = render(<PrimaryContactCard contact={null} selected={false} />);

    expect(screen.getByText('Select a row to view the primary contact.')).toBeInTheDocument();

    rerender(<PrimaryContactCard contact={null} selected />);
    expect(screen.getByText('No primary contact recorded.')).toBeInTheDocument();
  });

  it('keeps attendance empty state inside its own dashboard card', () => {
    render(<AttendanceCard cohorts={[]} selected />);

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('No attendance recorded.')).toHaveClass('dashboard-card__empty');
  });
});
