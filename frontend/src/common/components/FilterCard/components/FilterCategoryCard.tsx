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

const normalized = (values: string[]) => [...values].sort().join('\u0000');

export default function FilterCategoryCard({ category, value, active, resetVersion, onBack, onDraftCountChange, onApply }: FilterCategoryCardProps) {
  const [selected, setSelected] = useState(() => [...value]);
  const appliedKey = normalized(value);

  useEffect(() => {
    setSelected([...value]);
  }, [appliedKey, resetVersion]);

  useEffect(() => {
    onDraftCountChange(category.id, selected.length);
  }, [selected.length, category.id, onDraftCountChange]);

  const toggleOption = (option: string) => {
    setSelected(current => category.selectionMode === 'single'
      ? [option]
      : current.includes(option) ? current.filter(item => item !== option) : [...current, option]);
  };

  const clear = () => {
    setSelected([]);
    onApply([]);
  };

  // Keep inactive categories mounted so Back navigation preserves their local drafts.
  if (!active) return null;

  return <div>
    <div className="filter-card-header">
      <button type="button" role="menuitem" className="floating-menu-action filter-card-back" onClick={onBack} aria-label="Back to filter categories">
        <FontAwesomeIcon icon={faArrowLeft} />
      </button>
      <span>{category.label}</span>
    </div>
    <Checklist options={category.options} value={selected} onToggle={toggleOption} ariaLabel={category.label} inMenu />
    <div className="filter-card-footer">
      <Button type="button" role="menuitem" size="sm" onClick={clear} disabled={value.length === 0}>Clear</Button>
      <Button type="button" role="menuitem" size="sm" onClick={() => onApply(selected)} disabled={normalized(selected) === appliedKey}>Apply</Button>
    </div>
  </div>;
}
