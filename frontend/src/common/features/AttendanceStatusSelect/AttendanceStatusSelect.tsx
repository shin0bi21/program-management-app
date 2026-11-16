import FloatingSelect from '../../components/FloatingSelect/FloatingSelect';
import type { AttendanceStatus } from './types';
import './AttendanceStatusSelect.css';

const statusClassName = (status: AttendanceStatus | '') => (
  `attendance-status--${status || 'unmarked'}`
);

const enrolledOptions = [
  { id: 'present', label: 'Present', className: statusClassName('present') },
  { id: 'absent', label: 'Absent', className: statusClassName('absent') },
  { id: 'late', label: 'Late', className: statusClassName('late') },
  { id: 'excused', label: 'Excused', className: statusClassName('excused') },
  { id: '', label: 'Not marked', className: statusClassName('') },
] as const;

const openOptions = [
  { id: 'present', label: 'Attended', className: statusClassName('present') },
  { id: '', label: 'Not attended', className: statusClassName('') },
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
