import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import FloatingMenuPanel from '../../../FloatingMenu/FloatingMenuPanel';
import { useFloatingMenu } from '../../../FloatingMenu/hooks/useFloatingMenu';
import useViewportDismissal from '../../../FloatingMenu/hooks/useViewportDismissal';
import { calculateFloatingPositionFromRect, type FloatingPosition } from '../../../FloatingMenu/utils/floatingPosition';

export interface ItemDetail {
  label: string;
  value: ReactNode;
  multiline?: boolean;
  sectionStart?: boolean;
}

export interface ItemAction {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'danger';
}

const HOVER_DETAILS_DELAY_MS = 120;
const PRECISE_HOVER_QUERY = '(hover: hover) and (pointer: fine)';

interface ItemProps {
  id: string;
  ariaLabel: string;
  leading?: ReactNode;
  summary: ReactNode;
  trailing?: ReactNode;
  detailTitle: ReactNode;
  details: readonly ItemDetail[];
  actions?: readonly ItemAction[];
  onEdit?: () => void;
  onDelete?: () => void;
  selected?: boolean;
  className?: string;
}

export default function Item({
  id,
  ariaLabel,
  leading,
  summary,
  trailing,
  detailTitle,
  details,
  actions = [],
  onEdit,
  onDelete,
  selected = false,
  className = '',
}: ItemProps) {
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

  const supportsPreciseHover = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(PRECISE_HOVER_QUERY).matches;
  const showTouchDetails = isOpen && !supportsPreciseHover;
  const detailsOpen = detailPosition !== null;
  const hasActions = actions.length > 0 || Boolean(onEdit || onDelete);
  const detailsId = `calendar-item-details-${id}`;

  useViewportDismissal(detailsOpen, () => setDetailPosition(null));

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

    const periodCells = trigger.closest('.row')
      ?.querySelectorAll<HTMLElement>('.cell');
    // Ranged items can extend offscreen, so anchor details to the hovered visible period.
    const hoveredPeriod = clientX === undefined || clientX <= 0
      ? undefined
      : [...(periodCells ?? [])].find(cell => {
        const bounds = cell.getBoundingClientRect();

        return clientX >= bounds.left && clientX < bounds.right;
      });

    const itemBounds = trigger.getBoundingClientRect();
    const periodBounds = hoveredPeriod?.getBoundingClientRect();
    const anchorLeft = periodBounds ? Math.max(periodBounds.left, itemBounds.left) : itemBounds.left;
    const anchorRight = periodBounds ? Math.min(periodBounds.right, itemBounds.right) : itemBounds.right;

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

  const runAction = (action: () => void) => {
    close();
    action();
  };

  const viewDetails = () => {
    close();
    showDetails();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`calendar-item${selected ? ' selected' : ''}${isOpen ? ' menu-open' : ''}${className ? ` ${className}` : ''}`}
        aria-label={`${ariaLabel}${hasActions ? '. Open actions' : ''}`}
        aria-haspopup={hasActions ? 'menu' : undefined}
        aria-expanded={hasActions ? isOpen : undefined}
        aria-describedby={detailPosition ? detailsId : undefined}
        onMouseEnter={event => scheduleDetails(event.clientX)}
        onMouseLeave={hideDetails}
        onFocus={() => {
          if (triggerRef.current?.matches(':focus-visible')) showDetails();
        }}
        onBlur={hideDetails}
        onPointerDown={hideDetails}
        onClick={event => {
          hideDetails();

          if (!hasActions) return;

          if (isOpen) close();
          else {
            const anchor = getVisibleItemAnchor(event.clientX);

            if (anchor) openAtRect(anchor);
          }
        }}
      >
        {leading !== undefined && leading !== null && <strong>{leading}</strong>}
        <span className="summary">{summary}</span>
        {trailing !== undefined && trailing !== null && <span className="trailing">{trailing}</span>}
      </button>
      {detailPosition && createPortal(
        <div
          ref={detailRef}
          id={detailsId}
          role="tooltip"
          className="calendar-item-details"
          style={{ top: detailPosition.top, left: detailPosition.left }}
        >
          <strong>{detailTitle}</strong>
          <dl>
            {details.map(detail => (
              <div
                key={detail.label}
                className={[
                  detail.multiline ? 'multiline' : '',
                  detail.sectionStart ? 'section-start' : '',
                ].filter(Boolean).join(' ') || undefined}
              >
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        </div>,
        document.body,
      )}
      {position && hasActions && createPortal(
        <FloatingMenuPanel
          menuRef={menuRef}
          position={position}
          onClose={close}
          className="calendar-item-menu"
          width={150}
        >
          {showTouchDetails && (
            <button
              type="button"
              role="menuitem"
              onClick={event => {
                event.stopPropagation();
                viewDetails();
              }}
            >
              View details
            </button>
          )}
          {actions.map(action => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className={action.variant === 'danger' ? 'delete' : undefined}
              onClick={event => {
                event.stopPropagation();
                runAction(action.onClick);
              }}
            >
              {action.label}
            </button>
          ))}
          {onEdit && (
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
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              className="delete"
              onClick={event => {
                event.stopPropagation();
                runAction(onDelete);
              }}
            >
              Delete
            </button>
          )}
        </FloatingMenuPanel>,
        document.body,
      )}
    </>
  );
}
