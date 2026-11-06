import type { ReactNode } from 'react';

interface FormFieldGroupProps {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Groups related form controls under a legend; disabled uses native fieldset behavior for descendant controls.
 * Nested components such as Checklist still need their own accessible labels.
 * @example <FormFieldGroup label="Youth"><label><input type="checkbox" />Alex</label></FormFieldGroup>
 */
export default function FormFieldGroup({ label, children, disabled = false, className = '' }: FormFieldGroupProps) {
  return <fieldset className={`form-field-group${className ? ` ${className}` : ''}`} disabled={disabled}>
    <legend>{label}</legend>
    {children}
  </fieldset>;
}
