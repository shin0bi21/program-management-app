import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

interface ToolbarProps {
  year: number;

  onToday?: () => void;
  todayDisabled?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}

/**
 * Shows the visible year and supplied calendar navigation actions.
 * Both directional callbacks are required to show arrows; callers enforce navigation bounds.
 * @example <Toolbar year={2026} onToday={goToToday} todayDisabled /> shows a disabled Today button.
 */
export default function Toolbar({ year, onToday, todayDisabled = false, onPrevious, onNext }: ToolbarProps) {
  return (
    <div className="header" aria-label="Calendar navigation">
      {onPrevious && onNext && (
        <div className="nav-arrows">
          <button type="button" className="nav-arrow" aria-label="Previous" onClick={onPrevious}>
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
          </button>
          <button type="button" className="nav-arrow" aria-label="Next" onClick={onNext}>
            <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
          </button>
        </div>
      )}
      {onToday && (
        <button type="button" className="today" onClick={onToday} disabled={todayDisabled}>
          Today
        </button>
      )}
      <span className="year" aria-label={`Calendar year ${year}`} aria-live="polite">
        {year}
      </span>
    </div>
  );
}
