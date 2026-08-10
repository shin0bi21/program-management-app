import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FloatingMenuPanel from '../../../../../common/components/FloatingMenu/FloatingMenuPanel';
import { useFloatingMenu } from '../../../../../common/components/FloatingMenu/hooks/useFloatingMenu';
import { calculateFloatingPosition, type FloatingPosition } from '../../../../../common/components/FloatingMenu/utils/floatingPosition';
import type { TimesheetItem } from '../../types';
import './TimeItem.css';

interface TimeItemProps {
  item: TimesheetItem;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function TimeItem({ item, onEdit, onDelete }: TimeItemProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [detailPosition, setDetailPosition] = useState<FloatingPosition | null>(null);
  const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'start' },
    { widthEstimate: 150, heightEstimate: 86 },
  );

  const runAction = (action: () => void) => {
    close();
    action();
  };

  const showDetails = () => {
    if (!triggerRef.current) return;
    setDetailPosition(calculateFloatingPosition(
      triggerRef.current,
      { side: 'right', align: 'start' },
      { widthEstimate: 280, heightEstimate: 190, offset: 8 },
    ));
  };

  const hideDetails = () => setDetailPosition(null);
  const detailsId = `time-item-details-${item.id}`;
  const hasActions = Boolean(onEdit && onDelete);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`time-item${isOpen ? ' time-item--menu-open' : ''}`}
        aria-label={`${item.label}, ${item.hours} hours${hasActions ? '. Open actions' : ''}`}
        aria-haspopup={hasActions ? 'menu' : undefined}
        aria-expanded={hasActions ? isOpen : undefined}
        aria-describedby={detailPosition ? detailsId : undefined}
        onMouseEnter={showDetails}
        onMouseLeave={hideDetails}
        onFocus={showDetails}
        onBlur={hideDetails}
        onClick={event => {
          event.stopPropagation();
          hideDetails();
          if (hasActions) toggle();
        }}
      >
        <strong>{item.hours}h</strong>
        <span>{item.label} · {item.programName ?? 'General'}</span>
      </button>
      {detailPosition && createPortal(
        <div
          id={detailsId}
          role="tooltip"
          className="time-item-details"
          style={{ top: detailPosition.top, left: detailPosition.left }}
        >
          <strong>{item.label}</strong>
          <dl>
            <div><dt>Hours</dt><dd>{item.hours}</dd></div>
            <div><dt>Program</dt><dd>{item.programName ?? 'General'}</dd></div>
            {item.cohortName && <div><dt>Cohort</dt><dd>{item.cohortName}</dd></div>}
            <div className="time-item-details__note"><dt>Note</dt><dd>{item.note}</dd></div>
          </dl>
        </div>,
        document.body,
      )}
      {position && onEdit && onDelete && (
        <FloatingMenuPanel
          menuRef={menuRef}
          position={position}
          onClose={close}
          className="time-item-menu"
          width={150}
        >
          <button
            type="button"
            role="menuitem"
            onClick={event => {
              event.stopPropagation();
              runAction(onEdit);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="time-item-menu__delete"
            onClick={event => {
              event.stopPropagation();
              runAction(onDelete);
            }}
          >
            Delete
          </button>
        </FloatingMenuPanel>
      )}
    </>
  );
}
