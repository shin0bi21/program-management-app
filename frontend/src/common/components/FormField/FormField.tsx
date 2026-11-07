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

/**
 * Labels a control and associates a validation alert without replacing its existing descriptions.
 * @param props.id - Must match the contained control's ID so its label targets it.
 * @param props.children - One control that forwards aria-describedby and aria-invalid to its focusable element.
 * @param props.error - Nonempty message to display as an alert and mark the control invalid.
 * @example <FormField id="name" label="Name" error="Required"><input id="name" /></FormField>
 */
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
