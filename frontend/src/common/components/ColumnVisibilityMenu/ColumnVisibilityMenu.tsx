import { useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faColumns } from '@fortawesome/free-solid-svg-icons';
import Button from '../Button/Button';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import { useFloatingMenu } from '../FloatingMenu/hooks/useFloatingMenu';
import type { TableColumn } from '../Table/Table.types';
import './ColumnVisibilityMenu.css';

interface ColumnVisibilityMenuProps<T> {
  columns: TableColumn<T>[];
  hiddenColumnKeys: string[];
  onHiddenColumnKeysChange: (keys: string[]) => void;
  label?: string;
}

export default function ColumnVisibilityMenu<T>({
  columns,
  hiddenColumnKeys,
  onHiddenColumnKeysChange,
  label = 'Columns',
}: ColumnVisibilityMenuProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hideableColumns = useMemo(
    () => columns.filter(column => column.hideable !== false && column.resizable !== false),
    [columns],
  );
  const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'end' },
    {
      widthEstimate: 220,
      heightEstimate: hideableColumns.length * 40 + 50,
      dismissOnViewportChange: false,
    },
  );
  const visibleCount = hideableColumns.filter(column => !hiddenColumnKeys.includes(column.key)).length;

  const toggleColumn = (key: string) => {
    const hidden = hiddenColumnKeys.includes(key);
    if (!hidden && visibleCount === 1) return;
    onHiddenColumnKeysChange(hidden
      ? hiddenColumnKeys.filter(columnKey => columnKey !== key)
      : [...hiddenColumnKeys, key]);
  };

  return (
    <>
      <Button ref={triggerRef} variant="secondary" className="column-visibility-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={isOpen} onClick={toggle}>
        <FontAwesomeIcon icon={faColumns} aria-hidden="true" />
        <span className="column-visibility-menu-trigger__label">{label}</span>
      </Button>
      {position && (
        <FloatingMenuPanel menuRef={menuRef} position={position} onClose={close} className="column-visibility-menu" width={220}>
          <div className="column-visibility-menu__title">{label}</div>
          {hideableColumns.map(column => {
            const visible = !hiddenColumnKeys.includes(column.key);
            const disableHide = visible && visibleCount === 1;
            return (
              <button key={column.key} type="button" role="menuitemcheckbox" aria-checked={visible} disabled={disableHide} className="column-visibility-menu__option" onClick={() => toggleColumn(column.key)}>
                <span className={`column-visibility-menu__checkbox${visible ? ' checked' : ''}`}>{visible && <FontAwesomeIcon icon={faCheck} />}</span>
                <span>{column.header}</span>
              </button>
            );
          })}
        </FloatingMenuPanel>
      )}
    </>
  );
}
