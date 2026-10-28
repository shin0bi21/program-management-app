import Badge from '../../../../../common/components/Badge/Badge';
import './SessionTypeBadge.css';

interface SessionTypeBadgeProps {
  name: string;
  appearance?: 'table' | 'calendar';
}

const modifiersByName: Record<string, string> = {
  'Guest Speaker': 'guest-speaker',
  'Field Trip': 'field-trip',
};

export default function SessionTypeBadge({
  name,
  appearance = 'table',
}: SessionTypeBadgeProps) {
  const modifier = modifiersByName[name] ?? 'regular';

  return (
    <Badge
      className={
        `session-type-badge session-type-badge--${appearance} `
        + `session-type-badge--${modifier}`
      }
    >
      {name}
    </Badge>
  );
}
