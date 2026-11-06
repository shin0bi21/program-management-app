import { forwardRef, type ButtonHTMLAttributes, type PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  size?: ButtonSize;
}

/**
 * Renders a styled native button and forwards its ref and native attributes.
 * Defaults to type="button"; form submission requires type="submit".
 * @param props - Content, visual variant, size, optional full width, and native button attributes.
 * @param ref - Receives the underlying button for focus or other DOM access.
 * @example <Button type="submit" variant="primary" disabled={pending}>Save</Button>
 */
const Button = forwardRef<HTMLButtonElement, PropsWithChildren<ButtonProps>>(function Button(
  {
    children,
    className = '',
    variant = 'primary',
    fullWidth = false,
    size = 'md',
    type = 'button',
    ...props
  },
  ref,
) {
  const variantClass = variant === 'primary' ? '' : ` btn--${variant}`;
  const widthClass = fullWidth ? ' btn--full' : '';
  const sizeClass = size === 'md' ? '' : ` btn--${size}`;
  const classes = `btn${variantClass}${widthClass}${sizeClass}${className ? ` ${className}` : ''}`;

  return (
    <button ref={ref} type={type} className={classes} {...props}>
      {children}
    </button>
  );
});

export default Button;
