import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AttendanceStatusSelect from './AttendanceStatusSelect';

describe('AttendanceStatusSelect', () => {
  it('offers the complete enrolled attendance status set', () => {
    const onChange = vi.fn();
    render(
      <AttendanceStatusSelect
        id="attendance-status"
        ariaLabel="Attendance status"
        rosterMode="enrolled"
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Attendance status' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Late' }));
    expect(onChange).toHaveBeenCalledWith('late');
  });

  it('limits open attendance to attended or not attended', () => {
    render(
      <AttendanceStatusSelect
        id="open-attendance-status"
        ariaLabel="Open attendance status"
        rosterMode="open"
        value="present"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open attendance status' }));
    expect(screen.getByRole('menuitemradio', { name: 'Attended' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Not attended' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: 'Late' })).not.toBeInTheDocument();
  });
});
