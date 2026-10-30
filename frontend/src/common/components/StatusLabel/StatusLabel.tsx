import Label, { type LabelTone } from '../Label/Label';

const STATUS_TONES = {
  upcoming: 'info',
  active: 'positive',
  in_progress: 'attention',
  inactive: 'neutral',
  overdue: 'negative',
  completed: 'positive',
  cancelled: 'neutral',
} as const satisfies Record<string, LabelTone>;

interface StatusLabelProps {
  status: keyof typeof STATUS_TONES;
  label: string;
}

export default function StatusLabel({ status, label }: StatusLabelProps) {
  return <Label tone={STATUS_TONES[status]} className="status-label">{label}</Label>;
}
