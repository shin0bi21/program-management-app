import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import type { AttendanceStatus } from '../../../../common/types/cohort';

const enrolledOptions = [
  { value: '', label: 'Not marked' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
] as const;

const openOptions = [
  { value: '', label: 'Not attended' },
  { value: 'present', label: 'Attended' },
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
      onChange={nextValue => onChange(nextValue as AttendanceStatus | '')}
      options={rosterMode === 'open' ? openOptions : enrolledOptions}
    />
  );
}
