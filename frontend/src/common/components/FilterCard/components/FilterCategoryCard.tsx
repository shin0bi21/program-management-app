import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import Checklist from '../../Checklist/Checklist';
import Button from '../../Button/Button';
import type { FilterCardCategory } from '../types';

interface FilterCategoryCardProps {
  category: FilterCardCategory;
  value: string[];
  active: boolean;
  resetVersion: number;
  onBack: () => void;
  onDraftCountChange: (id: string, count: number) => void;
  onApply: (values: string[]) => void;
}

/**
 * Displays the choices and Back/Clear/Apply buttons for one filter group.
 * @param props.category - Group being edited, such as Status; option values must be unique and contain no null characters.
 * @param props.value - Applied option values without duplicates; checkbox edits stay in a draft until Apply or Clear.
 * @param props.active - Whether this group is visible; hiding it preserves the draft.
 * @param props.resetVersion - Changing this discards unapplied checkbox edits and restores applied values.
 * @param props.onBack - Returns to the group list without discarding this draft.
 * @param props.onDraftCountChange - Receives the group ID and draft count after mounting or a count change, including while hidden.
 * @param props.onApply - Receives draft values in selection order on Apply, or [] immediately on Clear; the caller updates value.
 * @example Navigating Back and returning preserves checks until the popup closes.
 */
export default function FilterCategoryCard({
  category,
  value,
  active,
  resetVersion,
  onBack,
  onDraftCountChange,
  onApply,
}: FilterCategoryCardProps) {
  const [selected, setSelected] = useState(() => [...value]);
  const appliedKey = getSelectionKey(value);
  const [previousInputs, setPreviousInputs] = useState({ appliedKey, resetVersion });

  // Reset before committing children so they never display or report the old draft.
  // Equivalent arrays from parent renders must not discard unapplied checkbox edits.
  if (previousInputs.appliedKey !== appliedKey || previousInputs.resetVersion !== resetVersion) {
    setPreviousInputs({ appliedKey, resetVersion });
    setSelected([...value]);
  }

  useEffect(() => {
    onDraftCountChange(category.id, selected.length);
  }, [selected.length, category.id, onDraftCountChange]);

  /**
   * Updates the local draft according to the category's single/multiple selection mode.
   * @param option - Value of an available category option clicked in the checklist.
   * @example Toggling 'inactive' in a single-choice draft ['active'] replaces it with ['inactive'].
   */
  const toggleOption = (option: string) => {
    setSelected(current => {
      if (category.selectionMode === 'single') return [option];
      if (current.includes(option)) return current.filter(item => item !== option);

      return [...current, option];
    });
  };

  /**
   * Clears both draft and applied values while leaving the category open.
   * @example Clear on ['active'] submits [] immediately.
   */
  const clear = () => {
    setSelected([]);
    onApply([]);
  };

  // Keep inactive categories mounted so Back navigation preserves their local drafts.
  if (!active) return null;

  return <div>
    <div className="filter-card-header">
      <button
        type="button"
        role="menuitem"
        className="floating-menu-action filter-card-back"
        onClick={onBack}
        aria-label="Back to filter categories"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
      </button>
      <span>{category.label}</span>
    </div>
    <Checklist
      options={category.options}
      value={selected}
      onToggle={toggleOption}
      ariaLabel={category.label}
      inMenu
    />
    <div className="filter-card-footer">
      <Button type="button" role="menuitem" size="sm" onClick={clear} disabled={value.length === 0}>Clear</Button>
      <Button
        type="button"
        role="menuitem"
        size="sm"
        onClick={() => onApply(selected)}
        disabled={getSelectionKey(selected) === appliedKey}
      >
        Apply
      </Button>
    </div>
  </div>;
}

/**
 * Builds an order-independent comparison key without mutating the selection.
 * @param values - Selected option values containing no null separator characters.
 * @returns A sorted, null-separated key used to compare draft and applied choices.
 * @example getSelectionKey(['b', 'a']) === getSelectionKey(['a', 'b']) // true
 */
function getSelectionKey(values: string[]) {
  return [...values].sort().join('\u0000');
}
