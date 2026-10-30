import Label from '../../../../../common/components/Label/Label';
import './SessionTypeLabel.css';

interface SessionTypeLabelProps {
  name: string;
  appearance?: 'table' | 'calendar';
}

const modifiersByName: Record<string, string> = {
  'Guest Speaker': 'guest-speaker',
  'Field Trip': 'field-trip',
};

export default function SessionTypeLabel({
  name,
  appearance = 'table',
}: SessionTypeLabelProps) {
  const modifier = modifiersByName[name] ?? 'regular';

  return (
    <Label
      className={
        `session-type-label session-type-label--${appearance} `
        + `session-type-label--${modifier}`
      }
    >
      {name}
    </Label>
  );
}
