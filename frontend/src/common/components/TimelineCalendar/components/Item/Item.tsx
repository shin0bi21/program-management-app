import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import FloatingMenuPanel from '../../../FloatingMenu/FloatingMenuPanel';
import useItemDetails from './hooks/useItemDetails/useItemDetails';
import useItemMenu from './hooks/useItemMenu/useItemMenu';
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
  const detailsId = `calendar-item-details-${id}`;
  const hasActions = actions.length > 0 || Boolean(onEdit || onDelete);
  const itemDetails = useItemDetails(triggerRef);
  const menu = useItemMenu({ triggerRef, hasActions, hideDetails: itemDetails.hideDetails, showDetails: itemDetails.showDetails });

  return (
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
}
