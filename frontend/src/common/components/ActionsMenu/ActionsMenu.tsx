import { useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { useFloatingMenu } from '../FloatingMenu/hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import Button from '../Button/Button';
import './ActionsMenu.css';

export interface ActionItem {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  groupStart?: boolean;
}

interface ActionsMenuProps {
  items: ActionItem[];
  disabled?: boolean;
  triggerLabel?: string;
  ariaLabel?: string;
}

/**
 * Displays a popup of actions and requests dismissal before invoking the chosen action.
 * Action callbacks handle their own asynchronous work and failures.
 * @param props.items - Available actions, such as Edit or Delete; omit actions the user cannot perform.
 * @param props.triggerLabel - Visible button text; omitting it shows the three-dot icon.
 * @param props.ariaLabel - Button name for assistive technology, needed with an icon-only trigger.
 * @example <ActionsMenu ariaLabel="Task actions" items={allowedActions} />
 */
export default function ActionsMenu({ items, disabled = false, triggerLabel, ariaLabel }: ActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: triggerLabel ? 'start' : 'end' },
    { heightEstimate: 200 },
  );

  /**
   * Requests dismissal, then invokes the selected action without awaiting it.
   * @param item - The selected action and its caller-provided callback.
   * @example Selecting Edit requests dismissal and invokes the Edit callback once.
   */
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
        aria-label={ariaLabel}
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
              className={`actions-menu-item${item.groupStart ? ' actions-menu-item--group-start' : ''}${
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
