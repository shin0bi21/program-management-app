import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import FloatingMenuPanel from '../../FloatingMenu/FloatingMenuPanel';
import { useFloatingMenu } from '../../FloatingMenu/hooks/useFloatingMenu';
import useViewportDismissal from '../../FloatingMenu/hooks/useViewportDismissal';
import { calculateFloatingPosition, type FloatingPosition } from '../../FloatingMenu/utils/floatingPosition';

export interface CalendarItemDetail {
  label: string;
  value: ReactNode;
  multiline?: boolean;
}

interface CalendarItemProps {
  id: string;
  ariaLabel: string;
  leading?: ReactNode;
  summary: ReactNode;
  trailing?: ReactNode;
  detailTitle: ReactNode;
  details: readonly CalendarItemDetail[];
  onEdit?: () => void;
  onDelete?: () => void;
  onActivate?: () => void;
  className?: string;
}

export default function CalendarItem({ id, ariaLabel, leading, summary, trailing, detailTitle, details, onEdit, onDelete, onActivate, className = '' }: CalendarItemProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [detailPosition, setDetailPosition] = useState<FloatingPosition | null>(null);
  const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'start' },
    { widthEstimate: 150, heightEstimate: 86 },
  );
  useViewportDismissal(detailPosition !== null, () => setDetailPosition(null));
  const hasActions = Boolean(onEdit && onDelete);
  const detailsId = `calendar-item-details-${id}`;
  const hideDetails = () => setDetailPosition(null);
  const showDetails = () => {
    if (!triggerRef.current) return;
    setDetailPosition(calculateFloatingPosition(triggerRef.current, { side: 'right', align: 'start' }, { widthEstimate: 300, heightEstimate: 190, offset: 8 }));
  };
  const runAction = (action: () => void) => { close(); action(); };

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`calendar-item${isOpen ? ' calendar-item--menu-open' : ''}${className ? ` ${className}` : ''}`}
      aria-label={`${ariaLabel}${hasActions ? '. Open actions' : ''}`}
      aria-haspopup={hasActions ? 'menu' : undefined}
      aria-expanded={hasActions ? isOpen : undefined}
      aria-describedby={detailPosition ? detailsId : undefined}
      onMouseEnter={showDetails}
      onMouseLeave={hideDetails}
      onFocus={() => { if (triggerRef.current?.matches(':focus-visible')) showDetails(); }}
      onBlur={hideDetails}
      onPointerDown={hideDetails}
      onClick={event => { event.stopPropagation(); hideDetails(); onActivate?.(); if (hasActions) toggle(); }}
    >
      {leading !== undefined && leading !== null && <strong>{leading}</strong>}
      <span className="calendar-item__summary">{summary}</span>
      {trailing !== undefined && trailing !== null && <span className="calendar-item__trailing">{trailing}</span>}
    </button>
    {detailPosition && createPortal(
      <div id={detailsId} role="tooltip" className="calendar-item-details" style={{ top: detailPosition.top, left: detailPosition.left }}>
        <strong>{detailTitle}</strong>
        <dl>{details.map(detail => <div key={detail.label} className={detail.multiline ? 'calendar-item-details__multiline' : undefined}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
      </div>, document.body,
    )}
    {position && onEdit && onDelete && createPortal(
      <FloatingMenuPanel menuRef={menuRef} position={position} onClose={close} className="calendar-item-menu" width={150}>
        <button type="button" role="menuitem" onClick={event => { event.stopPropagation(); runAction(onEdit); }}>Edit</button>
        <button type="button" role="menuitem" className="calendar-item-menu__delete" onClick={event => { event.stopPropagation(); runAction(onDelete); }}>Delete</button>
      </FloatingMenuPanel>, document.body,
    )}
  </>;
}
