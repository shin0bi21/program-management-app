import FloatingMenuPanel from '../../../FloatingMenu/FloatingMenuPanel';
import useCellActions, { CELL_MENU_WIDTH } from './hooks/useCellActions/useCellActions';
import type { CalendarCellAction, CalendarCellContext } from '../../types';

interface CellProps<TRow, TItemData> {
  className?: string;
  context: CalendarCellContext<TRow, TItemData>;
  rowId: string;
  onCellClick?: (context: CalendarCellContext<TRow, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TRow, TItemData>) => readonly CalendarCellAction[];
}

export default function Cell<TRow, TItemData>({
  className,
  context,
  rowId,
  onCellClick,
  getCellActions,
}: CellProps<TRow, TItemData>) {
  const {
    cellActions, hasCellActions, interactive, cellRef, cellMenu, handleClick, handleKeyDown, selectAction,
  } = useCellActions({ context, onCellClick, getCellActions });

  let ariaLabel: string | undefined;

  if (hasCellActions) ariaLabel = `Show actions for ${context.period.key}`;
  else if (onCellClick) ariaLabel = `Add item for ${context.period.key}`;

  return (
    <div
      ref={cellRef}
      className={`cell${className ? ` ${className}` : ''}${interactive ? ' interactive' : ''}`}
      data-period={context.period.key}
      data-row-id={rowId}
      role="gridcell"
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      aria-label={ariaLabel}
      aria-haspopup={hasCellActions ? 'menu' : undefined}
      aria-expanded={hasCellActions ? cellMenu.isOpen : undefined}
    >
      {cellMenu.position && (
        <FloatingMenuPanel
          menuRef={cellMenu.menuRef}
          position={cellMenu.position}
          onClose={cellMenu.close}
          width={CELL_MENU_WIDTH}
        >
          {cellActions.map(action => (
            <button
              type="button"
              role="menuitem"
              key={action.id}
              onClick={event => selectAction(event, action)}
            >
              {action.label}
            </button>
          ))}
        </FloatingMenuPanel>
      )}
    </div>
  );
}
