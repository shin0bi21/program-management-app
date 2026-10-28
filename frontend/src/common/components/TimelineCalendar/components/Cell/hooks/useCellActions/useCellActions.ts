import { useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { useFloatingMenu } from '../../../../../FloatingMenu/hooks/useFloatingMenu';
import type { CalendarCellAction, CalendarCellContext } from '../../../../types';

export const CELL_MENU_WIDTH = 180;

interface UseCellActionsOptions<TRow, TItemData> {
  context: CalendarCellContext<TRow, TItemData>;
  onCellClick?: (context: CalendarCellContext<TRow, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TRow, TItemData>) => readonly CalendarCellAction[];
}

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

  const selectAction = (event: MouseEvent<HTMLButtonElement>, action: CalendarCellAction) => {
    event.stopPropagation();
    cellMenu.close();
    action.onSelect();
  };

  return { cellActions, hasCellActions, interactive, cellRef, cellMenu, handleClick, handleKeyDown, selectAction };
}
