import { useState, useRef, useEffect } from 'react';
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)} disabled={disabled} style={{ width: '32px', height: '32px', padding: 0 }}>
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </Button>
      {open && (
        <div className="actions-menu">
          {items.map((item) => (
            <button
              key={item.label}
              className={`actions-menu-item${item.variant === 'danger' ? ' actions-menu-item--danger' : ''}`}
              onClick={() => { setOpen(false); item.onClick(); }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
