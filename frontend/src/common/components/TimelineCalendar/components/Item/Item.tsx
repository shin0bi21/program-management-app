import { useRef, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import FloatingMenuPanel from '../../../FloatingMenu/FloatingMenuPanel';
import useItemDetails from './hooks/useItemDetails/useItemDetails';
import useItemMenu from './hooks/useItemMenu/useItemMenu';
import type { ItemCalendarProps } from '../../types';
import useItemMove from './hooks/useItemMove/useItemMove';
import useItemResize from './hooks/useItemResize/useItemResize';
import './Item.css';

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

interface ItemProps<TRow, TItemData> {
  // Timeline placement and interactions
  calendar?: ItemCalendarProps<TRow, TItemData>;

  // Item identity and appearance
  id: string;
  ariaLabel: string;
  selected?: boolean;
  className?: string;

  // Summary content
  leading?: ReactNode;
  summary: ReactNode;
  trailing?: ReactNode;

  // Details content
  detailTitle: ReactNode;
  details: readonly ItemDetail[];

  // Menu actions
  actions?: readonly ItemAction[];
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Displays one calendar item with hover/focus details and optional actions, moving, and resizing.
 * @param props.calendar - Position and interaction data from buildItem; omit for a standalone preview.
 * @param props.ariaLabel - Complete item meaning, including type/status conveyed by color; dense layouts hide the visible summary.
 * @param props.details - Label/value pairs shown on hover or keyboard focus.
 * @example A three-day task shows one title across its date columns and its full schedule on hover.
 */
export default function Item<TRow, TItemData>({
  // Timeline placement and interactions
  calendar,

  // Item identity and appearance
  id,
  ariaLabel,
  selected = false,
  className = '',

  // Summary content
  leading,
  summary,
  trailing,

  // Details content
  detailTitle,
  details,

  // Menu actions
  actions = [],
  onEdit,
  onDelete,
}: ItemProps<TRow, TItemData>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const detailsId = `calendar-item-details-${id}`;
  const hasActions = actions.length > 0 || Boolean(onEdit || onDelete);
  const itemDetails = useItemDetails(triggerRef);
  const menu = useItemMenu({ triggerRef, hasActions, hideDetails: itemDetails.hideDetails, showDetails: itemDetails.showDetails });

  const move = useItemMove(calendar, itemDetails.hideDetails);
  const resize = useItemResize(calendar, itemDetails.hideDetails);

  /**
   * Ignores the click left by a drag; ordinary clicks select the item's row before activation.
   * @example A completed drag cannot also select or open the underlying item.
   */
  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!calendar) return;

    if (calendar.environment.isClickSuppressed()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    calendar.onSelect();
  };

  /**
   * Reports activation only for a timeline-mounted item.
   * @example Clicking a standalone content preview does not activate a calendar record.
   */
  const handleActivate = () => calendar?.onActivate();
  const content = (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`calendar-item${selected ? ' selected' : ''}${menu.isOpen ? ' menu-open' : ''}${className ? ` ${className}` : ''}`}
        aria-label={`${ariaLabel}${hasActions ? '. Open actions' : ''}`}
        aria-haspopup={hasActions ? 'menu' : undefined}
        aria-expanded={hasActions ? menu.isOpen : undefined}
        aria-describedby={itemDetails.position ? detailsId : undefined}
        onMouseEnter={itemDetails.onMouseEnter}
        onMouseLeave={itemDetails.hideDetails}
        onFocus={itemDetails.onFocus}
        onBlur={itemDetails.hideDetails}
        onPointerDown={itemDetails.hideDetails}
        onClick={menu.onClick}
      >
        {leading !== undefined && leading !== null && <strong>{leading}</strong>}
        <span className="summary">{summary}</span>
        {trailing !== undefined && trailing !== null && <span className="trailing">{trailing}</span>}
      </button>
      {itemDetails.position && createPortal(
        <div
          ref={itemDetails.detailRef}
          id={detailsId}
          role="tooltip"
          className="calendar-item-details"
          style={{ top: itemDetails.position.top, left: itemDetails.position.left }}
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
      {menu.position && hasActions && createPortal(
        <FloatingMenuPanel
          menuRef={menu.menuRef}
          position={menu.position}
          onClose={menu.close}
          className="calendar-item-menu"
          width={150}
        >
          {menu.showTouchDetails && (
            <button
              type="button"
              role="menuitem"
              onClick={menu.viewDetails}
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
              onClick={event => menu.runAction(event, action.onClick)}
            >
              {action.label}
            </button>
          ))}
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={event => menu.runAction(event, onEdit)}
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              className="delete"
              onClick={event => menu.runAction(event, onDelete)}
            >
              Delete
            </button>
          )}
        </FloatingMenuPanel>,
        document.body,
      )}
    </>
  );

  if (!calendar) return content;

  const { layout } = calendar;

  return (
    <div
      className={getPositionedItemClassName(calendar)}
      data-item-density={layout.density}
      data-item-row-id={layout.rowId}
      data-item-start={layout.start}
      data-item-end={layout.end}
      style={layout.style}
      onPointerDown={move.onPointerDown}
      onClickCapture={handleClickCapture}
      onClick={handleActivate}
    >
      {resize.startHandle && <button {...resize.startHandle} />}
      {content}
      {resize.endHandle && <button {...resize.endHandle} />}
    </div>
  );
}

/**
 * Produces wrapper modifiers from row-calculated clipping, density, and capabilities.
 * @returns Space-separated CSS classes for placement, clipping, and enabled interactions.
 * @example A compact item clipped at its start includes "compact continues-before".
 */
function getPositionedItemClassName<TRow, TItemData>({ layout, movable, resizable }: ItemCalendarProps<TRow, TItemData>) {
  return [
    'item', 'positioned-item', layout.density,
    !layout.startsInWindow ? 'continues-before' : '',
    !layout.endsInWindow ? 'continues-after' : '',
    layout.hideSummary ? 'summaries-hidden' : '',
    movable ? 'draggable' : '',
    resizable ? 'resizable' : '',
  ].filter(Boolean).join(' ');
}
