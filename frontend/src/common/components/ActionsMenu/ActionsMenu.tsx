import { useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenuPanel/FloatingMenuPanel';
import Button from '../Button/Button';
import './ActionsMenu.css';

export interface ActionItem {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface ActionsMenuProps {
  items: ActionItem[];
  disabled?: boolean;
}

export default function ActionsMenu({ items, disabled = false }: ActionsMenuProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);

  const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'end' },
    { heightEstimate: 200, returnFocusSelector: 'button' },
  );

  const handleActionClick = useCallback(
    (item: ActionItem) => {
      close();
      item.onClick();
    },
    [close],
  );

  return (
    <>
      <span ref={triggerRef} className="actions-menu-anchor">
        <Button
          variant="secondary"
          size="sm"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          disabled={disabled}
          className="actions-menu-trigger"
        >
          <FontAwesomeIcon icon={faEllipsisVertical} />
        </Button>
      </span>

      {position && (
        <FloatingMenuPanel
          menuRef={menuRef}
          position={position}
          onClose={close}
          className="actions-menu"
        >
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              className={`actions-menu-item${
                item.variant === 'danger' ? ' actions-menu-item--danger' : ''
              }`}
              onClick={() => handleActionClick(item)}
            >
              {item.label}
            </button>
          ))}
        </FloatingMenuPanel>
      )}
    </>
  );
}
