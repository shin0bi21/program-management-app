import type { ReactNode } from 'react';

export interface ConfirmAction {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  successMessage?: string;
  onConfirm: () => Promise<void>;
}
