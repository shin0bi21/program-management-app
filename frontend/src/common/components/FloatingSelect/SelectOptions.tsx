import type { KeyboardEvent } from 'react';
import { useSelectOptions } from './hooks/useSelectOptions';
import SearchInput from '../SearchInput/SearchInput';
import type { FloatingSelectOption, FloatingSelectOptionAction } from './FloatingSelect';

interface SelectOptionsProps {
  id: string;
  label: string;
  value: string;
  options: readonly FloatingSelectOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
  action?: { label: string; onSelect: () => void };
  optionActions?: (option: FloatingSelectOption) => FloatingSelectOptionAction[];
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'false' | 'true';
}

/**
 * Displays the searchable option list and actions inside an open FloatingSelect popup.
 * Unmount when the popup closes so reopening resets search and highlights the selected option.
 * @param props.onSelect - Reports a chosen value; the caller controls selection and dismissal.
 * @example With value="two", reopening shows all choices and highlights the option with value "two".
 */
export default function SelectOptions({
  id,
  label,
  value,
  options,
  onSelect,
  onClose,
  action,
  optionActions,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: SelectOptionsProps) {
  const {
    changeSearch,
    matches,
    activeIndex,
    activeOption,
    activeId,
    listId,
    listRef,
    setActiveValue,
    moveActiveOption,
  } = useSelectOptions({ id, value, options });
  const actions = activeOption && optionActions ? optionActions(activeOption) : [];

  /**
   * Selects an existing highlight on Enter or moves it with vertical arrows.
   * @example Enter with no matching options never emits a new free-text value.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeOption) onSelect(activeOption.value);
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    moveActiveOption(event.key === 'ArrowDown' ? 1 : -1);
  };

  /**
   * Dismisses this session before invoking an option or global action.
   * @example Add program closes the selector before its caller opens an editor.
   */
  const runAction = (onAction: () => void) => {
    onClose();
    onAction();
  };

  return (
    <>
      <SearchInput
        className="floating-select-search"
        label={`Search ${label}`}
        placeholder="Search…"
        onChange={changeSearch}
        autoFocus
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        onKeyDown={handleKeyDown}
      />
      {action && (
        <button
          type="button"
          className="floating-menu-action floating-select-action"
          onClick={() => runAction(action.onSelect)}
        >
          {action.label}
        </button>
      )}
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        tabIndex={-1}
        aria-label={label}
        className="floating-select-options"
      >
        {matches.map((option, index) => (
          <div
            key={option.value}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={option.value === value}
            className={`floating-select-option${index === activeIndex ? ' floating-select-option--active' : ''}${option.className ? ` ${option.className}` : ''}`}
            onPointerMove={() => setActiveValue(option.value)}
            onMouseDown={event => event.preventDefault()}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </div>
        ))}
      </div>
      {matches.length === 0 && (
        <span role="status" className="floating-select-empty">No matching options.</span>
      )}
      {activeOption && actions.length > 0 && (
        <div className="floating-select-option-actions" role="group" aria-label={`Actions for ${activeOption.label}`}>
          {actions.map(optionAction => (
            <button
              key={optionAction.label}
              type="button"
              aria-label={`${optionAction.label} ${activeOption.label}`}
              className={`floating-menu-action floating-select-option-action${optionAction.variant === 'danger' ? ' floating-select-option-action--danger' : ''}`}
              onClick={() => runAction(optionAction.onSelect)}
            >
              {optionAction.icon ?? optionAction.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
