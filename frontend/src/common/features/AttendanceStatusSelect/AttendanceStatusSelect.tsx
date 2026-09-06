import FloatingSelect from '../../components/FloatingSelect/FloatingSelect';
import type { AttendanceStatus } from './types';
import './AttendanceStatusSelect.css';

const statusClassName = (status: AttendanceStatus | '') => (
  `attendance-status--${status || 'unmarked'}`
);

const enrolledOptions = [
  { value: 'present', label: 'Present', className: statusClassName('present') },
  { value: 'absent', label: 'Absent', className: statusClassName('absent') },
  { value: 'late', label: 'Late', className: statusClassName('late') },
  { value: 'excused', label: 'Excused', className: statusClassName('excused') },
  { value: '', label: 'Not marked', className: statusClassName('') },
] as const;

const openOptions = [
  { value: 'present', label: 'Attended', className: statusClassName('present') },
  { value: '', label: 'Not attended', className: statusClassName('') },
] as const;

export default function AttendanceStatusSelect({
  id,
  ariaLabel,
  rosterMode,
  value,
  disabled = false,
  onChange,
}: {
  id: string;
  ariaLabel: string;
  rosterMode: 'enrolled' | 'open';
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
      options={rosterMode === 'open' ? openOptions : enrolledOptions}
    />
  );
}
