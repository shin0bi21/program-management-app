import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCheck } from '@fortawesome/free-solid-svg-icons';
import Button from '../../Button/Button';
import { getDefaultDateRange, getDateRangeError, isDateRange, type DateRange } from '../../../utils/dateRange';
import type { DateRangePreset, FilterCardCategory } from '../types';

interface SharedProps {
  active: boolean;
  resetVersion: number;
  onBack: () => void;
  onDraftCountChange: (id: string, count: number) => void;
}

type FilterCategoryCardProps = SharedProps & ({
  kind: 'list';
  category: FilterCardCategory;
  value: string[];
  onApply: (values: string[]) => void;
} | {
  kind: 'date-range';
  value: DateRange;
  presets?: DateRangePreset[];
  onApply: (range: DateRange) => void;
});

const normalized = (values: string[]) => [...values].sort().join('\u0000');

export default function FilterCategoryCard(props: FilterCategoryCardProps) {
  const { active, resetVersion, onBack, onDraftCountChange } = props;
  const [selected, setSelected] = useState(() => props.kind === 'list' ? [...props.value] : []);
  const [dates, setDates] = useState(() => props.kind === 'date-range' ? props.value : getDefaultDateRange());
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const isDateCategory = props.kind === 'date-range';
  const id = props.kind === 'list' ? props.category.id : 'date-range';
  const title = props.kind === 'list' ? props.category.label : 'Date Range';
  const appliedKey = props.kind === 'list' ? normalized(props.value) : `${props.value.start}:${props.value.end}`;

  useEffect(() => {
    if (props.kind === 'list') setSelected([...props.value]);
    else setDates(props.value);
    setSelectedPresetId(null);
  }, [appliedKey, resetVersion]);

  const defaultRange = getDefaultDateRange();
  const dateCount = dates.start !== defaultRange.start || dates.end !== defaultRange.end ? 1 : 0;
  const draftCount = isDateCategory ? dateCount : selected.length;
  useEffect(() => {
    onDraftCountChange(id, draftCount);
  }, [draftCount, id, onDraftCountChange]);

  const toggleOption = (value: string) => {
    if (props.kind !== 'list') return;

    setSelected(current => props.category.selectionMode === 'single'
      ? [value]
      : current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  };

  const clear = () => {
    if (props.kind === 'date-range') {
      setSelectedPresetId(null);
      setDates(defaultRange);
      props.onApply(defaultRange);
    } else {
      setSelected([]);
      props.onApply([]);
    }
  };

  const apply = () => {
    if (props.kind === 'date-range') {
      if (isDateRange(dates)) props.onApply(dates);
    } else props.onApply(selected);
  };

  const dateError = isDateCategory ? getDateRangeError(dates) : null;
  const clearDisabled = props.kind === 'list' ? props.value.length === 0
    : props.value.start === defaultRange.start && props.value.end === defaultRange.end;
  const applyDisabled = props.kind === 'list' ? normalized(selected) === appliedKey
    : Boolean(dateError) || `${dates.start}:${dates.end}` === appliedKey;
  const itemRole = isDateCategory ? undefined : 'menuitem';
  const matchedPreset = props.kind === 'date-range' && selectedPresetId !== ''
    ? props.presets?.find(preset => (selectedPresetId === null || preset.id === selectedPresetId)
      && preset.range.start === dates.start && preset.range.end === dates.end)
    : undefined;

  // Keep inactive categories mounted so Back navigation preserves their local drafts.
  if (!active) return null;

  const content = <>
    <div className="filter-card-header">
      <button type="button" role={itemRole} className="floating-menu-action filter-card-back" onClick={onBack} aria-label="Back to filter categories">
        <FontAwesomeIcon icon={faArrowLeft} />
      </button>
      <span>{title}</span>
    </div>
    <div className="filter-card-options">
      {props.kind === 'date-range' ? <>
        {props.presets && <div role="group" aria-label="Date presets">
          {[...props.presets, { id: '', label: 'Custom', range: dates }].map(preset => {
            const checked = preset.id === (matchedPreset?.id ?? '');

            return <button key={preset.id} type="button" role="checkbox" aria-checked={checked}
              className="floating-menu-action filter-card-option" disabled={preset.id !== '' && !isDateRange(preset.range)}
              onClick={() => {
                setSelectedPresetId(preset.id);
                if (preset.id !== '') setDates(preset.range);
              }}>
              <span className={`filter-card-checkbox${checked ? ' checked' : ''}`}>{checked && <FontAwesomeIcon icon={faCheck} />}</span>
              <span>{preset.label}</span>
            </button>;
          })}
        </div>}
        <div className="filter-card-date-fields">
        <label>From <input type="date" required value={dates.start}
          onChange={event => {
            setSelectedPresetId('');
            setDates(current => ({ ...current, start: event.target.value }));
          }} /></label>
        <label>To <input type="date" required value={dates.end}
          onChange={event => {
            setSelectedPresetId('');
            setDates(current => ({ ...current, end: event.target.value }));
          }} /></label>
        {dateError && <p role="alert">{dateError}</p>}
        </div>
      </> : props.category.options.map(option => {
        const checked = selected.includes(option.value);
        return <button key={option.value} type="button" role="menuitemcheckbox" aria-checked={checked}
          className="filter-card-option" onClick={() => toggleOption(option.value)}>
          <span className={`filter-card-checkbox${checked ? ' checked' : ''}`}>{checked && <FontAwesomeIcon icon={faCheck} />}</span>
          <span>{option.label}</span>
        </button>;
      })}
    </div>
    <div className="filter-card-footer">
      <Button type="button" role={itemRole} size="sm" onClick={clear} disabled={clearDisabled}>Clear</Button>
      <Button type={isDateCategory ? 'submit' : 'button'} role={itemRole} size="sm"
        onClick={isDateCategory ? undefined : apply} disabled={applyDisabled}>Apply</Button>
    </div>
  </>;

  return isDateCategory ? <form onSubmit={event => {
    event.preventDefault();
    if (!applyDisabled) apply();
  }}>{content}</form> : <div>{content}</div>;
}
