import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AttendanceStatusSelect from './AttendanceStatusSelect';

describe('AttendanceStatusSelect', () => {
  it('emits the selected enrolled attendance status', () => {
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
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Late' }));
    expect(onChange).toHaveBeenCalledWith('late');
  });

  it('prevents enrollment-only statuses for open attendance', () => {
    const onChange = vi.fn();
    render(
      <AttendanceStatusSelect
        id="open-attendance-status"
        ariaLabel="Open attendance status"
        enrollmentRequired={false}
        value="present"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open attendance status' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Late' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: 'Absent' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: 'Excused' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Not attended' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
