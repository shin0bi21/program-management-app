import {
  cloneElement,
  isValidElement,
  type ReactElement,
} from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  children: ReactElement<{
    'aria-describedby'?: string;
    'aria-invalid'?: boolean | 'false' | 'true';
  }>;
}

export default function FormField({ id, label, error, children }: FormFieldProps) {
  const errorId = `${id}-error`;
  const control = error && isValidElement(children)
    ? cloneElement(children, {
      'aria-describedby': [children.props['aria-describedby'], errorId].filter(Boolean).join(' '),
      'aria-invalid': true,
    })
    : children;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {control}
      {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    </div>
  );
}
