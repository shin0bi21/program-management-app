import { useRef, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '../Button/Button';
import './SearchInput.css';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  appliedValue?: string;
  onApply?: () => void;
  onClear: () => void;
}

/**
 * Displays a controlled search field with Clear and an optional Search button.
 * The caller owns draft and applied text; Clear invokes onClear and then focuses the input.
 * @param props.value - Text currently being edited.
 * @param props.appliedValue - Search currently used by results, which may differ from the edited text.
 * @param props.onApply - Applies the text on Search/Enter; omit for search-as-you-type controls.
 * @param props.onClear - Resets the caller's draft and applied search values.
 * @example With value="" and appliedValue="Maya", Clear stays enabled to remove the applied search.
 */
export default function SearchInput({
  label,
  appliedValue,
  className = '',
  type = 'text',
  onApply,
  onClear,
  value,
  disabled,
  onKeyDown,
  ...inputProps
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Runs the caller's key handler before applying Enter without submitting a parent form.
   * @example A prevented Enter skips onApply; an unhandled Enter invokes it when supplied.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      onApply?.();
    }
  };

  return (
    <div className={`search-input${className ? ` ${className}` : ''}`}>
      {onApply && (
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
      )}
      <label className="search-input__field">
        <span className="sr-only">{label}</span>
        <input ref={inputRef} type={type} value={value} disabled={disabled} onKeyDown={handleKeyDown} {...inputProps} />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="search-input__clear"
        aria-label="Clear search"
        title="Clear search"
        disabled={disabled || (!String(value ?? '') && !appliedValue)}
        onClick={() => {
          onClear();
          inputRef.current?.focus();
        }}
      >
        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
      </Button>
    </div>
  );
}
