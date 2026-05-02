import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  size?: ButtonSize;
}

export default function Button({
  children,
  className = '',
  variant = 'primary',
  fullWidth = false,
  size = 'md',
  type = 'button',
  ...props
}: PropsWithChildren<ButtonProps>) {
  const variantClass = variant === 'primary' ? '' : ` btn--${variant}`;
  const widthClass = fullWidth ? ' btn--full' : '';
  const sizeClass = size === 'md' ? '' : ` btn--${size}`;
  const classes = `btn${variantClass}${widthClass}${sizeClass}${className ? ` ${className}` : ''}`;

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}