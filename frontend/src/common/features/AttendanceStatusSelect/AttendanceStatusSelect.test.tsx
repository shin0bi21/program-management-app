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
        enrollmentRequired={true}
        value=""
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Attendance status' });
    expect(trigger).toHaveClass('attendance-status--unmarked');
    expect(trigger).not.toHaveClass('attendance-status');
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitemradio', { name: 'Present' })).toHaveClass('attendance-status--present');
    expect(screen.getByRole('menuitemradio', { name: 'Absent' })).toHaveClass('attendance-status--absent');
    expect(screen.getByRole('menuitemradio', { name: 'Late' })).toHaveClass('attendance-status--late');
    expect(screen.getByRole('menuitemradio', { name: 'Excused' })).toHaveClass('attendance-status--excused');
    expect(screen.getAllByRole('menuitemradio').map(option => option.textContent)).toEqual([
      'Present', 'Absent', 'Late', 'Excused', 'Not marked',
    ]);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Late' }));
    expect(onChange).toHaveBeenCalledWith('late');
  });

  it('limits open attendance to attended or not attended', () => {
    render(
      <AttendanceStatusSelect
        id="open-attendance-status"
        ariaLabel="Open attendance status"
        enrollmentRequired={false}
        value="present"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open attendance status' }));
    expect(screen.getByRole('menuitemradio', { name: 'Attended' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Not attended' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio').map(option => option.textContent)).toEqual([
      'Attended', 'Not attended',
    ]);
    expect(screen.queryByRole('menuitemradio', { name: 'Late' })).not.toBeInTheDocument();
  });
});
