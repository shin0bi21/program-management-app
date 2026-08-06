import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttendanceCard, PrimaryContactCard } from './DetailCards';

describe('DetailCards', () => {
  it('distinguishes no row selection from a selected row with no contact', () => {
    const { rerender } = render(<PrimaryContactCard contact={null} selected={false} />);

    expect(screen.getByText('Select a row to view the primary contact.')).toBeInTheDocument();

    rerender(<PrimaryContactCard contact={null} selected />);
    expect(screen.getByText('No primary contact recorded.')).toBeInTheDocument();
  });

  it('shows primary contact details in one compact summary', () => {
    render(<PrimaryContactCard contact={{
      phoneNumber: '2262604073',
      relationship: 'parent',
    }} selected />);

    const summary = screen.getByText('2262604073').closest('p');
    expect(summary).toHaveClass('primary-contact-card__summary');
    expect(summary).toContainElement(screen.getByText('2262604073'));
    expect(summary).toContainElement(screen.getByText('Parent'));
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
  });

  it('keeps attendance empty state inside its own dashboard card', () => {
    render(<AttendanceCard cohorts={[]} selected />);

    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('No active cohort attendance.')).toHaveClass('dashboard-card__empty');
  });

  it('separates active and historical attendance by program and cohort', () => {
    render(<AttendanceCard selected cohorts={[
      {
        id: 'active-cohort',
        name: 'Summer 2026',
        programName: 'Soft Skills',
        rosterMode: 'enrolled',
        startsOn: '2000-01-01',
        endsOn: '2999-12-31',
        withdrawnOn: null,
        presentCount: 2,
        lateCount: 1,
        absentCount: 0,
        lastAttendedOn: '2026-07-21',
      },
      {
        id: 'historic-cohort',
        name: 'Spring 2025',
        programName: 'Drop In',
        rosterMode: 'open',
        startsOn: '2025-01-01',
        endsOn: '2025-06-30',
        withdrawnOn: null,
        presentCount: 3,
        lateCount: 0,
        absentCount: 0,
        lastAttendedOn: '2025-05-10',
      },
    ]} />);

    expect(screen.getByText('Soft Skills · Summer 2026')).toBeInTheDocument();
    expect(screen.queryByText('Drop In · Spring 2025')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    expect(screen.getByText('Drop In · Spring 2025')).toBeInTheDocument();
    expect(screen.queryByText('Soft Skills · Summer 2026')).not.toBeInTheDocument();
  });
});
