import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import FloatingMenuPanel from '../../FloatingMenu/FloatingMenuPanel';
import { useFloatingMenu } from '../../FloatingMenu/hooks/useFloatingMenu';
import useViewportDismissal from '../../FloatingMenu/hooks/useViewportDismissal';
import { calculateFloatingPositionFromRect, type FloatingPosition } from '../../FloatingMenu/utils/floatingPosition';

export interface CalendarItemDetail {
  label: string;
  value: ReactNode;
  multiline?: boolean;
  sectionStart?: boolean;
}

export interface CalendarItemAction {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'danger';
}

const HOVER_DETAILS_DELAY_MS = 120;

interface CalendarItemProps {
  id: string;
  ariaLabel: string;
  leading?: ReactNode;
  summary: ReactNode;
  trailing?: ReactNode;
  detailTitle: ReactNode;
  details: readonly CalendarItemDetail[];
  actions?: readonly CalendarItemAction[];
  onEdit?: () => void;
  onDelete?: () => void;
  onActivate?: () => void;
  className?: string;
}

export default function CalendarItem({ id, ariaLabel, leading, summary, trailing, detailTitle, details, actions = [], onEdit, onDelete, onActivate, className = '' }: CalendarItemProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const detailAnchorRef = useRef<DOMRect | null>(null);
  const detailSizeRef = useRef<{ width: number; height: number } | null>(null);
  const detailOpenTimerRef = useRef<number | null>(null);
  const [detailPosition, setDetailPosition] = useState<FloatingPosition | null>(null);
  const { isOpen, openAtRect, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'start' },
    { widthEstimate: 150, heightEstimate: 86 },
  );
  useViewportDismissal(detailPosition !== null, () => setDetailPosition(null));
  const hasActions = actions.length > 0 || Boolean(onEdit && onDelete);
  const detailsId = `calendar-item-details-${id}`;
  const cancelPendingDetails = () => {
    if (detailOpenTimerRef.current === null) return;
    window.clearTimeout(detailOpenTimerRef.current);
    detailOpenTimerRef.current = null;
  };
  const hideDetails = () => {
    cancelPendingDetails();
    detailAnchorRef.current = null;
    setDetailPosition(null);
  };
  const getVisibleItemAnchor = (clientX?: number) => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const daySlots = trigger.closest('.resource-calendar__row')
      ?.querySelectorAll<HTMLElement>('.resource-calendar__item-slot');
    const hoveredDay = clientX === undefined || clientX <= 0 ? undefined : [...(daySlots ?? [])].find(slot => {
      const bounds = slot.getBoundingClientRect();
      return clientX >= bounds.left && clientX < bounds.right;
    });
    const itemBounds = trigger.getBoundingClientRect();
    const dayBounds = hoveredDay?.getBoundingClientRect();
    const anchorLeft = dayBounds ? Math.max(dayBounds.left, itemBounds.left) : itemBounds.left;
    const anchorRight = dayBounds ? Math.min(dayBounds.right, itemBounds.right) : itemBounds.right;
    return new DOMRect(
      anchorLeft,
      itemBounds.top,
      anchorRight - anchorLeft,
      itemBounds.height,
    );
  };
  const showDetails = (clientX?: number) => {
    const anchorBounds = getVisibleItemAnchor(clientX);
    if (!anchorBounds) return;
    detailAnchorRef.current = anchorBounds;
    const measuredSize = detailSizeRef.current;
    const next = calculateFloatingPositionFromRect(
      anchorBounds,
      { side: 'bottom', align: 'start' },
      {
        widthEstimate: measuredSize?.width ?? 300,
        heightEstimate: measuredSize?.height ?? 190,
        offset: 8,
      },
    );
    setDetailPosition(current => current?.top === next.top && current.left === next.left ? current : next);
  };
  const scheduleDetails = (clientX: number) => {
    cancelPendingDetails();
    detailOpenTimerRef.current = window.setTimeout(() => {
      detailOpenTimerRef.current = null;
      showDetails(clientX);
    }, HOVER_DETAILS_DELAY_MS);
  };
  const detailsOpen = detailPosition !== null;
  useLayoutEffect(() => () => {
    if (detailOpenTimerRef.current !== null) window.clearTimeout(detailOpenTimerRef.current);
  }, []);
  useLayoutEffect(() => {
    const detail = detailRef.current;
    if (!detailsOpen || !detail) return undefined;
    const reposition = () => {
      const anchor = detailAnchorRef.current;
      if (!anchor) return;
      const bounds = detail.getBoundingClientRect();
      detailSizeRef.current = { width: bounds.width, height: bounds.height };
      const next = calculateFloatingPositionFromRect(
        anchor,
        { side: 'bottom', align: 'start' },
        { widthEstimate: bounds.width, heightEstimate: bounds.height, offset: 8 },
      );
      setDetailPosition(current => current?.top === next.top && current.left === next.left ? current : next);
    };
    reposition();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(reposition);
    observer.observe(detail);
    return () => observer.disconnect();
  }, [detailsOpen]);
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
      onMouseEnter={event => scheduleDetails(event.clientX)}
      onMouseLeave={hideDetails}
      onFocus={() => { if (triggerRef.current?.matches(':focus-visible')) showDetails(); }}
      onBlur={hideDetails}
      onPointerDown={hideDetails}
      onClick={event => {
        event.stopPropagation();
        hideDetails();
        onActivate?.();
        if (!hasActions) return;
        if (isOpen) close();
        else {
          const anchor = getVisibleItemAnchor(event.clientX);
          if (anchor) openAtRect(anchor);
        }
      }}
    >
      {leading !== undefined && leading !== null && <strong>{leading}</strong>}
      <span className="calendar-item__summary">{summary}</span>
      {trailing !== undefined && trailing !== null && <span className="calendar-item__trailing">{trailing}</span>}
    </button>
    {detailPosition && createPortal(
      <div ref={detailRef} id={detailsId} role="tooltip" className="calendar-item-details" style={{ top: detailPosition.top, left: detailPosition.left }}>
        <strong>{detailTitle}</strong>
        <dl>{details.map(detail => <div
          key={detail.label}
          className={[
            detail.multiline ? 'calendar-item-details__multiline' : '',
            detail.sectionStart ? 'calendar-item-details__section-start' : '',
          ].filter(Boolean).join(' ') || undefined}
        ><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
      </div>, document.body,
    )}
    {position && hasActions && createPortal(
      <FloatingMenuPanel menuRef={menuRef} position={position} onClose={close} className="calendar-item-menu" width={150}>
        {actions.map(action => <button
          key={action.id}
          type="button"
          role="menuitem"
          className={action.variant === 'danger' ? 'calendar-item-menu__delete' : undefined}
          onClick={event => { event.stopPropagation(); runAction(action.onClick); }}
        >{action.label}</button>)}
        {onEdit && onDelete && <>
          <button type="button" role="menuitem" onClick={event => { event.stopPropagation(); runAction(onEdit); }}>Edit</button>
          <button type="button" role="menuitem" className="calendar-item-menu__delete" onClick={event => { event.stopPropagation(); runAction(onDelete); }}>Delete</button>
        </>}
      </FloatingMenuPanel>, document.body,
    )}
  </>;
}
