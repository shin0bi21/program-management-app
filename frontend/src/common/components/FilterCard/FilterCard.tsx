import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faFilter } from '@fortawesome/free-solid-svg-icons';
import { useFloatingMenu } from '../FloatingMenu/hooks/useFloatingMenu';
import { getMenuItems } from '../FloatingMenu/utils/floatingMenuUtils';
import Button from '../Button/Button';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import FilterCategoryCard from './components/FilterCategoryCard';
import type { FilterCardCategory, FilterCardValues } from './types';
import './FilterCard.css';

export type { FilterCardOption, FilterCardCategory, FilterCardValues } from './types';

interface FilterCardProps {
  categories: FilterCardCategory[];
  values: FilterCardValues;
  onApply: (categoryId: string, values: string[]) => void;
  onClearAll?: () => void;
  label?: string;
}

export default function FilterCard({ categories, values, onApply, onClearAll, label = 'Filters' }: FilterCardProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { isOpen, open, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'end' },
    { widthEstimate: 264, heightEstimate: 320 },
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [draftCounts, setDraftCounts] = useState<Record<string, number>>({});
  const [resetVersion, setResetVersion] = useState(0);

  const toggle = () => {
    if (isOpen) {
      close();
      return;
    }

    setActiveCategoryId(null);
    setDraftCounts({});
    open();
  };

  useLayoutEffect(() => {
    if (!isOpen) return;

    getMenuItems(menuRef.current)[0]?.focus();
  }, [activeCategoryId, isOpen, menuRef]);

  const recordDraftCount = useCallback((id: string, count: number) => {
    setDraftCounts(current => current[id] === count ? current : { ...current, [id]: count });
  }, []);

  const appliedCount = categories.reduce((total, category) => total + (values[category.id]?.length ?? 0), 0);
  const draftCount = Object.values(draftCounts).reduce((total, count) => total + count, 0);

  const clearAll = () => {
    setResetVersion(current => current + 1);
    onClearAll?.();
  };

  return <>
    <Button ref={triggerRef} variant="secondary" onClick={toggle} aria-label={label} aria-haspopup="menu" aria-expanded={isOpen} className="filter-card-trigger">
      <FontAwesomeIcon icon={faFilter} />
      <span className="filter-card-trigger__label">{label}</span>
      {appliedCount > 0 && <span className="filter-card-count" aria-label={`${appliedCount} active filters`}>{appliedCount}</span>}
    </Button>

    {position && <FloatingMenuPanel menuRef={menuRef} position={position} onClose={close} className="filter-card">
      {categories.map(category => <FilterCategoryCard key={category.id} category={category}
        active={activeCategoryId === category.id} value={values[category.id] ?? []} resetVersion={resetVersion}
        onBack={() => setActiveCategoryId(null)} onDraftCountChange={recordDraftCount}
        onApply={selected => onApply(category.id, selected)} />)}
      {activeCategoryId === null && <>
        <div className="filter-card-title">{label}</div>
        {categories.map(category => {
          const count = draftCounts[category.id] ?? values[category.id]?.length ?? 0;
          return <button key={category.id} type="button" role="menuitem" className="filter-card-category" onClick={() => setActiveCategoryId(category.id)}>
            <span>{category.label}</span>
            <span className="filter-card-category-meta">{count > 0 && <span>{count}</span>}<FontAwesomeIcon icon={faChevronRight} /></span>
          </button>;
        })}
        {onClearAll && <div className="filter-card-root-footer">
          <Button role="menuitem" size="sm" onClick={clearAll} disabled={appliedCount === 0 && draftCount === 0}>Clear all</Button>
        </div>}
      </>}
    </FloatingMenuPanel>}
  </>;
}
