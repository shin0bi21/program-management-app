import type { ReactNode } from 'react';
import './Label.css';

export type LabelTone = 'positive' | 'negative' | 'neutral' | 'attention' | 'info';

interface LabelProps {
  children: ReactNode;
  tone?: LabelTone;
  className?: string;
}

export default function Label({ children, tone, className = '' }: LabelProps) {
  const classes = ['label', tone && `label--${tone}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
