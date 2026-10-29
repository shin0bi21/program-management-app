import { useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { useFloatingMenu } from '../../../../../FloatingMenu/hooks/useFloatingMenu';
import type { CalendarCellAction, CalendarCellContext } from '../../../../types';

export const CELL_MENU_WIDTH = 180;

interface UseCellActionsOptions<TRow, TItemData> {
  context: CalendarCellContext<TRow, TItemData>;

  onCellClick?: (context: CalendarCellContext<TRow, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TRow, TItemData>) => readonly CalendarCellAction[];
}

/**
 * Owns cell activation and its optional action-menu lifecycle.
 * Requires: context describes the cell's row and period.
 * Example: Enter invokes its primary callback or opens its available actions.
 */
export default function useCellActions<TRow, TItemData>({
  context, onCellClick, getCellActions,
}: UseCellActionsOptions<TRow, TItemData>) {
  const cellActions = getCellActions?.(context) ?? [];
  const hasCellActions = cellActions.length > 0;
  const interactive = Boolean(onCellClick || hasCellActions);

  const cellRef = useRef<HTMLDivElement>(null);
  const cellMenu = useFloatingMenu(
    cellRef,
    { side: 'bottom', align: 'start' },
    { widthEstimate: CELL_MENU_WIDTH, heightEstimate: 90 },
  );

  /** Invokes the primary action or opens the available cell-action menu. */
  function activateCell(point?: { x: number; y: number }): void {
    if (!hasCellActions) {
      onCellClick?.(context);
      return;
    }

    if (point) cellMenu.openAtPoint(point.x, point.y);
    else cellMenu.toggle();
  }

  /** Activates the cell at the clicked pointer position. */
  function handleClick(event: MouseEvent<HTMLDivElement>): void {
    activateCell({ x: event.clientX, y: event.clientY });
  }

  /** Activates the cell for Enter/Space while ignoring events from nested controls. */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    activateCell();
  }

  /** Closes the menu before reporting the selected action without bubbling the click. */
  function selectAction(event: MouseEvent<HTMLButtonElement>, action: CalendarCellAction): void {
    event.stopPropagation();
    cellMenu.close();
    action.onSelect();
  }

  return { cellActions, hasCellActions, interactive, cellRef, cellMenu, handleClick, handleKeyDown, selectAction };
}
