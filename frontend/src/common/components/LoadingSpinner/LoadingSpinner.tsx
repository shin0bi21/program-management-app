import './LoadingSpinner.css';

type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <span
      className={`loading-spinner loading-spinner--${size}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  );
}
