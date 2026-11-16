import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useChecklistItems } from './hooks/useChecklistItems';
import SearchInput from '../SearchInput/SearchInput';
import './Checklist.css';

interface ChecklistProps {
  options: readonly { id: string; label: string }[];
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

/**
 * Displays controlled checkbox choices, optionally filtered by a local search field.
 * In a floating panel, search requires keyboardMode="form" and the default inMenu=false.
 * @param props.options - Available choices with unique IDs and display names; extra reference fields are preserved.
 * @param props.value - IDs of the checked choices.
 * @param props.onToggle - Receives the activated choice ID; the caller updates value to change its checked state.
 * @param props.inMenu - Uses checkbox menu items; the caller supplies the surrounding menu and its keyboard navigation.
 * @param props.search - Includes live filtering; choose once for the mounted checklist.
 * @param props.dynamicItems - Reveals 25 choices at a time as the user scrolls or tabs.
 * @example <Checklist options={[{ id: "fall", label: "Fall 2026" }]} value={["fall"]} onToggle={toggleCycle} ariaLabel="Cycles" /> // Fall 2026 is checked.
 */
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
  const { itemsRef, setSearch, items, loadMoreItems, handleScroll } = useChecklistItems({
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
        <SearchInput
          className="checklist-search"
          type="search"
          label={`Search ${ariaLabel}`}
          placeholder="Search…"
          disabled={disabled}
          onChange={setSearch}
        />
      )}
      <div className="checklist-items" ref={itemsRef} onScroll={handleScroll}>
        {items.map((option, index) => {
          const checked = value.includes(option.id);
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
              key={option.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              className="checklist-option"
              disabled={disabled}
              onClick={() => onToggle(option.id)}
              onFocus={isLastItem ? loadMoreItems : undefined}
            >
              {content}
            </button>
          ) : (
            <label key={option.id} className={`checklist-option${disabled ? ' disabled' : ''}`}>
              <input
                type="checkbox"
                value={option.id}
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(option.id)}
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
