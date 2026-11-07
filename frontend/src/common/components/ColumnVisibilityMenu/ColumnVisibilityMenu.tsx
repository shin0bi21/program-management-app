import { useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faColumns } from '@fortawesome/free-solid-svg-icons';
import Button from '../Button/Button';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import { useFloatingMenu } from '../FloatingMenu/hooks/useFloatingMenu';
import {
  getTableColumnCanHide,
  getTableColumnHeader,
  getTableColumnId,
  type TableColumnDef,
} from '../Table/Table.types';
import './ColumnVisibilityMenu.css';

interface ColumnVisibilityMenuProps<T> {
  columns: TableColumnDef<T, unknown>[];
  hiddenColumnKeys: string[];
  onHiddenColumnKeysChange: (keys: string[]) => void;
  label?: string;
}

/**
 * Displays controlled column visibility choices and prevents hiding the final visible hideable column.
 * Changes leave the menu open; the caller supplies the updated hidden column IDs.
 * @param props.columns - Flat columns with stable IDs and string titles; enableHiding=false excludes a column.
 * @param props.hiddenColumnKeys - IDs of columns currently hidden, such as ['notes'].
 * @param props.onHiddenColumnKeysChange - Receives the requested list of hidden column IDs.
 * @param props.label - Trigger text, accessible name, and menu heading; defaults to 'Columns'.
 * @example Unchecking Notes adds 'notes' to the hidden columns while leaving other columns visible.
 */
export default function ColumnVisibilityMenu<T>({
  columns,
  hiddenColumnKeys,
  onHiddenColumnKeysChange,
  label = 'Columns',
}: ColumnVisibilityMenuProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hideableColumns = useMemo(
    () => columns.filter(getTableColumnCanHide),
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
  const visibleCount = hideableColumns.filter(
    column => !hiddenColumnKeys.includes(getTableColumnId(column)),
  ).length;

  /**
   * Requests a visibility toggle unless it would hide the last hideable column.
   * @param key - ID of one of this menu's hideable columns.
   * @example Toggling a hidden 'notes' removes it from hiddenColumnKeys.
   */
  const toggleColumn = (key: string) => {
    const hidden = hiddenColumnKeys.includes(key);
    if (!hidden && visibleCount === 1) return;

    const nextHiddenColumnKeys = hidden
      ? hiddenColumnKeys.filter(columnKey => columnKey !== key)
      : [...hiddenColumnKeys, key];

    onHiddenColumnKeysChange(nextHiddenColumnKeys);
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
            const key = getTableColumnId(column);
            const visible = !hiddenColumnKeys.includes(key);
            const disableHide = visible && visibleCount === 1;

            return (
              <button key={key} type="button" role="menuitemcheckbox" aria-checked={visible} disabled={disableHide} className="column-visibility-menu__option" onClick={() => toggleColumn(key)}>
                <span className={`column-visibility-menu__checkbox${visible ? ' checked' : ''}`}>{visible && <FontAwesomeIcon icon={faCheck} />}</span>
                <span>{getTableColumnHeader(column)}</span>
              </button>
            );
          })}
        </FloatingMenuPanel>
      )}
    </>
  );
}
