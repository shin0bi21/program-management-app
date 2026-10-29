import Badge from '../Badge/Badge';
import './StatusBadge.css';

interface StatusBadgeProps {
  status: 'upcoming' | 'active' | 'inactive' | 'overdue' | 'completed' | 'cancelled';
  label: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return <Badge className={`status-label status-label--${status}`}>{label}</Badge>;
}
