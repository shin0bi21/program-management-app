import Button from '../Button/Button';

import './UnavailableState.css';

interface UnavailableStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export default function UnavailableState({
  title,
  message = 'Refresh to try loading this content again.',
  onRetry,
  compact = false,
}: UnavailableStateProps) {
  return <div className={`unavailable-state${compact ? ' unavailable-state--compact' : ''}`}>
    <strong>{title}</strong>
    <p>{message}</p>
    {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>}
  </div>;
}
