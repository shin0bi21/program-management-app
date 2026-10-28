import type { ReactNode } from 'react';
import './Badge.css';

export default function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`badge ${className}`.trim()}>{children}</span>;
}
