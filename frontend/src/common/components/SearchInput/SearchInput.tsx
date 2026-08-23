import type { InputHTMLAttributes, KeyboardEvent } from 'react';
import Button from '../Button/Button';
import './SearchInput.css';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onKeyDown'> {
  label: string;
  appliedValue: string;
  onApply: () => void;
  onClear: () => void;
}

export default function SearchInput({
  label,
  appliedValue,
  className = '',
  type = 'text',
  onApply,
  onClear,
  value,
  disabled,
  ...inputProps
}: SearchInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onApply();
    }
  };

  return (
    <div className={`search-input${className ? ` ${className}` : ''}`}>
      <label className="search-input__field">
        <span className="sr-only">{label}</span>
        <input type={type} value={value} disabled={disabled} onKeyDown={handleKeyDown} {...inputProps} />
      </label>
      <Button type="button" size="sm" disabled={disabled} onClick={onApply}>Search</Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="search-input__clear"
        aria-label="Clear search"
        title="Clear search"
        disabled={disabled || (!String(value ?? '') && !appliedValue)}
        onClick={onClear}
      >×</Button>
    </div>
  );
}
