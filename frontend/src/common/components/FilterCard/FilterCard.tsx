import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCheck, faChevronRight, faFilter } from '@fortawesome/free-solid-svg-icons';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';
import { getMenuItems } from '../../utils/floatingMenuUtils';
import Button from '../Button/Button';
import FloatingMenuPanel from '../FloatingMenuPanel/FloatingMenuPanel';
import './FilterCard.css';

export interface FilterCardOption {
  value: string;
  label: string;
}

export interface FilterCardCategory {
  id: string;
  label: string;
  options: FilterCardOption[];
}

export type FilterCardValues = Record<string, string[]>;

interface FilterCardProps {
  categories: FilterCardCategory[];
  values: FilterCardValues;
  onApply: (categoryId: string, values: string[]) => void;
  onClearAll?: () => void;
  label?: string;
}

const normalized = (values: string[] = []) => [...values].sort().join('\u0000');

export default function FilterCard({ categories, values, onApply, onClearAll, label = 'Filters' }: FilterCardProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'end' },
    { widthEstimate: 264, heightEstimate: 320 },
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<FilterCardValues>({});

  useEffect(() => {
    if (!isOpen) return;
    setActiveCategoryId(null);
    setDrafts(Object.fromEntries(categories.map(category => [category.id, [...(values[category.id] ?? [])]])));
  }, [isOpen]); // values are intentionally captured only when a session opens

  useLayoutEffect(() => {
    if (!isOpen) return;
    getMenuItems(menuRef.current)[0]?.focus();
  }, [activeCategoryId, isOpen, menuRef]);

  const activeCategory = categories.find(category => category.id === activeCategoryId) ?? null;
  const appliedCount = useMemo(
    () => categories.reduce((total, category) => total + (values[category.id]?.length ?? 0), 0),
    [categories, values],
  );
  const draftCount = categories.reduce((total, category) => total + (drafts[category.id]?.length ?? 0), 0);

  const toggleOption = (categoryId: string, value: string) => {
    setDrafts(current => {
      const selected = current[categoryId] ?? [];
      return {
        ...current,
        [categoryId]: selected.includes(value)
          ? selected.filter(item => item !== value)
          : [...selected, value],
      };
    });
  };

  const applyActiveCategory = () => {
    if (!activeCategory) return;
    onApply(activeCategory.id, drafts[activeCategory.id] ?? []);
  };

  const clearActiveCategory = () => {
    if (!activeCategory) return;
    setDrafts(current => ({ ...current, [activeCategory.id]: [] }));
    onApply(activeCategory.id, []);
  };

  const clearAll = () => {
    setDrafts(Object.fromEntries(categories.map(category => [category.id, []])));
    onClearAll?.();
  };

  return (
    <>
      <Button ref={triggerRef} variant="secondary" onClick={toggle} aria-haspopup="menu" aria-expanded={isOpen} className="filter-card-trigger">
        <FontAwesomeIcon icon={faFilter} />
        <span>{label}</span>
        {appliedCount > 0 && <span className="filter-card-count" aria-label={`${appliedCount} active filters`}>{appliedCount}</span>}
      </Button>

      {position && (
        <FloatingMenuPanel menuRef={menuRef} position={position} onClose={close} className="filter-card">
          {activeCategory ? (
            <>
              <div className="filter-card-header">
                <button type="button" role="menuitem" className="filter-card-back" onClick={() => setActiveCategoryId(null)} aria-label="Back to filter categories">
                  <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <span>{activeCategory.label}</span>
              </div>
              <div className="filter-card-options">
                {activeCategory.options.map(option => {
                  const checked = (drafts[activeCategory.id] ?? []).includes(option.value);
                  return (
                    <button key={option.value} type="button" role="menuitemcheckbox" aria-checked={checked} className="filter-card-option" onClick={() => toggleOption(activeCategory.id, option.value)}>
                      <span className={`filter-card-checkbox${checked ? ' checked' : ''}`}>{checked && <FontAwesomeIcon icon={faCheck} />}</span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="filter-card-footer">
                <Button role="menuitem" size="sm" onClick={clearActiveCategory} disabled={(values[activeCategory.id]?.length ?? 0) === 0}>Clear</Button>
                <Button role="menuitem" size="sm" onClick={applyActiveCategory} disabled={normalized(drafts[activeCategory.id]) === normalized(values[activeCategory.id])}>Apply</Button>
              </div>
            </>
          ) : (
            <>
              <div className="filter-card-title">{label}</div>
              {categories.map(category => {
                const count = drafts[category.id]?.length ?? 0;
                return (
                  <button key={category.id} type="button" role="menuitem" className="filter-card-category" onClick={() => setActiveCategoryId(category.id)}>
                    <span>{category.label}</span>
                    <span className="filter-card-category-meta">{count > 0 && <span>{count}</span>}<FontAwesomeIcon icon={faChevronRight} /></span>
                  </button>
                );
              })}
              {onClearAll && (
                <div className="filter-card-root-footer">
                  <Button role="menuitem" size="sm" onClick={clearAll} disabled={appliedCount === 0 && draftCount === 0}>Clear all</Button>
                </div>
              )}
            </>
          )}
        </FloatingMenuPanel>
      )}
    </>
  );
}
