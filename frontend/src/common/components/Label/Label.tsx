import type { ReactNode } from 'react';
import './Label.css';

export type LabelTone = 'positive' | 'negative' | 'neutral' | 'attention' | 'info';

interface LabelProps {
  children: ReactNode;
  tone?: LabelTone;
  className?: string;
}

/**
 * Displays a short text badge, optionally colored by its meaning.
 * Category badges can omit tone and supply their own color styles through className.
 * @example <Label tone="negative">Overdue</Label> displays Overdue in the negative palette.
 */
export default function Label({ children, tone, className = '' }: LabelProps) {
  const classes = ['label', tone && `label--${tone}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
