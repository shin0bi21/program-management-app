import { useRef, type KeyboardEvent, type MouseEvent } from 'react';
import FloatingMenuPanel from '../../../FloatingMenu/FloatingMenuPanel';
import { useFloatingMenu } from '../../../FloatingMenu/hooks/useFloatingMenu';
import type { CalendarCellAction, CalendarCellContext } from '../../types';

const CELL_MENU_WIDTH = 180;

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
  const cellActions = getCellActions?.(context) ?? [];
  const hasCellActions = cellActions.length > 0;
  const interactive = Boolean(onCellClick || hasCellActions);

  const cellRef = useRef<HTMLDivElement>(null);
  const cellMenu = useFloatingMenu(
    cellRef,
    { side: 'bottom', align: 'start' },
    { widthEstimate: CELL_MENU_WIDTH, heightEstimate: 90 },
  );

  const activateCell = (point?: { x: number; y: number }) => {
    if (!hasCellActions) {
      onCellClick?.(context);
      return;
    }

    if (point) cellMenu.openAtPoint(point.x, point.y);
    else cellMenu.toggle();
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    activateCell({ x: event.clientX, y: event.clientY });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    activateCell();
  };

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
              onClick={event => {
                event.stopPropagation();
                cellMenu.close();
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </FloatingMenuPanel>
      )}
    </div>
  );
}
