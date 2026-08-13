import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

interface ResourceCalendarToolbarProps {
  year: number;
  onToday?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export default function ResourceCalendarToolbar({ year, onToday, onPrevious, onNext }: ResourceCalendarToolbarProps) {
  return (
    <div className="resource-calendar__toolbar" aria-label="Calendar navigation">
      {onPrevious && onNext && (
        <div className="resource-calendar__navigation-arrows">
          <button type="button" className="resource-calendar__navigation-arrow" aria-label="Previous" onClick={onPrevious}>
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
          </button>
          <button type="button" className="resource-calendar__navigation-arrow" aria-label="Next" onClick={onNext}>
            <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
          </button>
        </div>
      )}
      {onToday && (
        <button type="button" className="resource-calendar__today" onClick={onToday}>
          Today
        </button>
      )}
      <span className="resource-calendar__year" aria-label={`Calendar year ${year}`} aria-live="polite">
        {year}
      </span>
    </div>
  );
}
