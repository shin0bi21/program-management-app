import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useChecklistItems } from './hooks/useChecklistItems';
import './Checklist.css';

interface ChecklistProps {
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onToggle: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  inMenu?: boolean;
  variant?: 'compact' | 'form';
  className?: string;
  dynamicItems?: boolean;
  search?: boolean;
}

export default function Checklist({
  options,
  value,
  onToggle,
  ariaLabel,
  disabled = false,
  inMenu = false,
  variant = 'compact',
  className = '',
  dynamicItems = false,
  search: searchEnabled = false,
}: ChecklistProps) {
  const { itemsRef, search, setSearch, items, loadMoreItems, handleScroll } = useChecklistItems({
    options,
    dynamicItems,
    searchEnabled,
  });

  return (
    <div
      className={`checklist checklist--${variant}${dynamicItems ? ' checklist--dynamic' : ''}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {searchEnabled && (
        <div className="checklist-search form-field">
          <input
            type="search"
            aria-label={`Search ${ariaLabel}`}
            placeholder="Search…"
            value={search}
            disabled={disabled}
            onChange={event => setSearch(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') event.preventDefault();

              if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation();
            }}
          />
        </div>
      )}
      <div className="checklist-items" ref={itemsRef} onScroll={handleScroll}>
        {items.map((option, index) => {
          const checked = value.includes(option.value);
          const isLastItem = index === items.length - 1;
          const content = (
            <>
              {(inMenu || variant === 'compact') && (
                <span aria-hidden="true" className={`checklist-indicator${checked ? ' checked' : ''}`}>
                  {checked && <FontAwesomeIcon icon={faCheck} />}
                </span>
              )}
              <span className="checklist-label">{option.label}</span>
            </>
          );

          return inMenu ? (
            <button
              key={option.value}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              className="checklist-option"
              disabled={disabled}
              onClick={() => onToggle(option.value)}
              onFocus={isLastItem ? loadMoreItems : undefined}
            >
              {content}
            </button>
          ) : (
            <label key={option.value} className={`checklist-option${disabled ? ' disabled' : ''}`}>
              <input
                type="checkbox"
                value={option.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(option.value)}
                onFocus={isLastItem ? loadMoreItems : undefined}
              />
              {content}
            </label>
          );
        })}
        {searchEnabled && items.length === 0 && (
          <p className="checklist-empty" role="status">No matching items.</p>
        )}
      </div>
    </div>
  );
}
