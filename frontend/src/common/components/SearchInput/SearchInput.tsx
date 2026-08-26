import type { InputHTMLAttributes, KeyboardEvent } from 'react';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
      <Button
        type="button"
        size="sm"
        className="search-input__apply"
        aria-label="Search"
        title="Search"
        disabled={disabled}
        onClick={onApply}
      >
        <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
      </Button>
      <label className="search-input__field">
        <span className="sr-only">{label}</span>
        <input type={type} value={value} disabled={disabled} onKeyDown={handleKeyDown} {...inputProps} />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="search-input__clear"
        aria-label="Clear search"
        title="Clear search"
        disabled={disabled || (!String(value ?? '') && !appliedValue)}
        onClick={onClear}
      >
        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
      </Button>
    </div>
  );
}
