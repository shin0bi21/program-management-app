import type { InputHTMLAttributes } from 'react';
import './SearchInput.css';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function SearchInput({ label, className = '', type = 'text', ...inputProps }: SearchInputProps) {
  return (
    <label className={`search-input ${className}`.trim()}>
      <span className="sr-only">{label}</span>
      <input type={type} {...inputProps} />
    </label>
  );
}
