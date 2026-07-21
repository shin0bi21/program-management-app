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
  triggerLabel?: string;
}

export default function ActionsMenu({ items, disabled = false, triggerLabel }: ActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: triggerLabel ? 'start' : 'end' },
    { heightEstimate: 200 },
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
      <Button
        ref={triggerRef}
        variant={triggerLabel ? 'primary' : 'secondary'}
        size={triggerLabel ? 'md' : 'sm'}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled}
        className={triggerLabel ? 'actions-menu-trigger--labeled' : 'actions-menu-trigger'}
      >
        {triggerLabel ?? <FontAwesomeIcon icon={faEllipsisVertical} />}
      </Button>

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
