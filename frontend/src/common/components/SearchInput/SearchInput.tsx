import { useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactElement } from 'react';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '../Button/Button';
import './SearchInput.css';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> {
  label: string;
  appliedValue?: string;
  onChange?: (search: string) => void;
  onApply?: (search: string) => void;
}

/**
 * Displays a search field with Clear and an optional Search action.
 * Always owns its textbox draft; callbacks report edits, submissions, and clearing.
 * Clear applies an empty string through the same submission handler and focuses the input.
 * Escape blurs the input without changing its draft; a caller may handle it first to dismiss a containing popup.
 * Tab bubbles for focus navigation; other input keys stay inside the field.
 * @param props.appliedValue - Active search displayed until the user starts editing.
 * @param props.onChange - Receives edited text; also receives Clear when onApply is omitted.
 * @param props.onApply - Receives trimmed text on Search/Enter; omit for live filtering.
 * @example With appliedValue="Maya", typing "  Alex  " keeps Maya applied until Search submits "Alex".
 */
export default function SearchInput({
  label,
  appliedValue,
  className = '',
  type = 'text',
  onApply,
  onChange,
  disabled,
  onKeyDown,
  ...inputProps
}: SearchInputProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const searchValue = draft ?? appliedValue ?? '';

  /**
   * Trims and displays submitted text, notifying the applied-search or live-filter callback.
   * @param value - Text to submit; Clear supplies an empty string.
   * @example applySearch("  Alex  ") submits "Alex"; applySearch("") clears the search.
   */
  const applySearch = (value: string) => {
    const search = value.trim();
    setDraft(search);
    if (onApply) onApply(search);
    else onChange?.(search);
  };

  /**
   * Runs caller navigation, then blurs on unhandled Escape or applies unhandled Enter.
   * @example A prevented Enter skips onApply; an unhandled Enter invokes it when supplied.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Tab') event.stopPropagation();

    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (onApply) applySearch(searchValue);
    }
  };

  return (
    <div className={`search-input${className ? ` ${className}` : ''}`}>
      {onApply && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="search-input__apply"
          aria-label="Search"
          title="Search"
          disabled={disabled}
          onClick={() => applySearch(searchValue)}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
        </Button>
      )}
      <label className="search-input__field">
        <span className="sr-only">{label}</span>
        <input
          ref={inputRef}
          type={type}
          value={searchValue}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          onChange={event => {
            const search = event.target.value;
            setDraft(search);
            onChange?.(search);
          }}
          {...inputProps}
        />
      </label>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="search-input__clear"
        aria-label="Clear search"
        title="Clear search"
        disabled={disabled || (!searchValue && !appliedValue)}
        onClick={() => {
          applySearch('');
          inputRef.current?.focus();
        }}
      >
        <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
      </Button>
    </div>
  );
}
