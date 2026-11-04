import type { ReactNode } from 'react';

export interface ConfirmAction {
  title: string;
  message: ReactNode;
  confirmVariant?: 'primary' | 'danger';
  successMessage?: string;
  onConfirm: () => Promise<void>;
}
