import './LoadingSpinner.css';

type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
};

export default function LoadingSpinner({ size = 'md', className = '', label }: LoadingSpinnerProps) {
  const spinner = (
    <span
      className={`loading-spinner loading-spinner--${size}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  );

  return label ? <span className="loading-spinner-label">{spinner}<span>{label}</span></span> : spinner;
}
