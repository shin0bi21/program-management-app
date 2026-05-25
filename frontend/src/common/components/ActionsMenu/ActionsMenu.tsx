import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import Button from '../Button/Button';
import './ActionsMenu.css';

export interface ActionItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface ActionsMenuProps {
  items: ActionItem[];
  disabled?: boolean;
}

export default function ActionsMenu({ items, disabled = false }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <span ref={btnRef} style={{ display: 'inline-block' }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={open ? () => setOpen(false) : openMenu}
          disabled={disabled}
          style={{ width: '32px', height: '32px', padding: 0 }}
        >
          <FontAwesomeIcon icon={faEllipsisVertical} />
        </Button>
      </span>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="actions-menu"
          style={{ top: pos.top, right: pos.right }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              className={`actions-menu-item${item.variant === 'danger' ? ' actions-menu-item--danger' : ''}`}
              onClick={() => { setOpen(false); item.onClick(); }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
