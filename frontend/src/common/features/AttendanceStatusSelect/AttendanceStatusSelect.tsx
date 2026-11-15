import FloatingSelect from '../../components/FloatingSelect/FloatingSelect';
import type { AttendanceStatus } from './types';
import './AttendanceStatusSelect.css';

const statusClassName = (status: AttendanceStatus | '') => (
  `attendance-status--${status || 'unmarked'}`
);

const enrolledOptions = [
  { id: 'present', name: 'Present', className: statusClassName('present') },
  { id: 'absent', name: 'Absent', className: statusClassName('absent') },
  { id: 'late', name: 'Late', className: statusClassName('late') },
  { id: 'excused', name: 'Excused', className: statusClassName('excused') },
  { id: '', name: 'Not marked', className: statusClassName('') },
] as const;

const openOptions = [
  { id: 'present', name: 'Attended', className: statusClassName('present') },
  { id: '', name: 'Not attended', className: statusClassName('') },
] as const;

export default function AttendanceStatusSelect({
  id,
  ariaLabel,
  enrollmentRequired,
  value,
  disabled = false,
  onChange,
}: {
  id: string;
  ariaLabel: string;
  enrollmentRequired: boolean;
  value: AttendanceStatus | '';
  disabled?: boolean;
  onChange: (value: AttendanceStatus | '') => void;
}) {
  return (
    <FloatingSelect
      id={id}
      ariaLabel={ariaLabel}
      value={value}
      disabled={disabled}
      className={statusClassName(value)}
      onChange={nextValue => onChange(nextValue as AttendanceStatus | '')}
      options={!enrollmentRequired ? openOptions : enrolledOptions}
    />
  );
}
