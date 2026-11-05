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

// Mounting with the popup gives every open session fresh search and navigation state.
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
    search,
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
        value={search}
        onChange={event => changeSearch(event.target.value)}
        onClear={() => changeSearch('')}
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
