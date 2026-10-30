import type { ReactNode } from 'react';

interface FormFieldGroupProps {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function FormFieldGroup({ label, children, disabled = false, className = '' }: FormFieldGroupProps) {
  return <fieldset className={`form-field-group${className ? ` ${className}` : ''}`} disabled={disabled}>
    <legend>{label}</legend>
    {children}
  </fieldset>;
}
