import { useRef, type ReactNode } from 'react';
import FloatingMenuPanel from '../../FloatingMenu/FloatingMenuPanel';
import { useFloatingMenu } from '../../FloatingMenu/hooks/useFloatingMenu';
import type { CalendarCellAction, CalendarCellContext, CellOverflowContext } from '../types';

interface ResourceCalendarCellProps<TResource, TItemData> {
  className?: string;
  context: CalendarCellContext<TResource, TItemData>;
  resourceId: string;
  getItemId: (item: TItemData) => string;
  renderOverflowItem: (item: TItemData, onDragEnd: () => void, closeOverflow: () => void) => ReactNode;
  onCellClick?: (context: CalendarCellContext<TResource, TItemData>) => void;
  getCellActions?: (context: CalendarCellContext<TResource, TItemData>) => readonly CalendarCellAction[];
  maxVisibleItems: number;
  renderOverflowSummary?: (context: CellOverflowContext<TResource, TItemData>) => ReactNode;
}

export default function ResourceCalendarCell<TResource, TItemData>({
  className,
  context,
  resourceId,
  getItemId,
  renderOverflowItem,
  onCellClick,
  getCellActions,
  maxVisibleItems,
  renderOverflowSummary,
}: ResourceCalendarCellProps<TResource, TItemData>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'start' },
    { widthEstimate: 230, heightEstimate: 180 },
  );
  const hasOverflow = context.items.length > maxVisibleItems;
  const cellActions = getCellActions?.(context) ?? [];
  const interactive = Boolean(onCellClick || cellActions.length);
  const cellRef = useRef<HTMLDivElement>(null);
  const cellMenu = useFloatingMenu(cellRef, { side: 'bottom', align: 'start' }, { widthEstimate: 180, heightEstimate: 90 });
  const overflowContext = { ...context, itemCount: context.items.length };

  return (
    <div
      ref={cellRef}
      className={`resource-calendar__cell${className ? ` ${className}` : ''}${interactive ? ' resource-calendar__cell--interactive' : ''}`}
      data-period={context.period.key}
      data-resource-id={resourceId}
      role={interactive ? 'gridcell' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onCellClick || cellActions.length ? event => { if (cellActions.length) cellMenu.openAtPoint(event.clientX, event.clientY); else onCellClick?.(context); } : undefined}
      onKeyDown={interactive ? event => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (cellActions.length) cellMenu.toggle(); else onCellClick?.(context);
      } : undefined}
      aria-label={interactive ? `Add item for ${context.period.key}` : undefined}
    >
      {hasOverflow && (
        <button
          ref={triggerRef}
          type="button"
          className="resource-calendar__overflow-summary"
          aria-label={`Show all ${context.items.length} items for ${context.period.key}`}
          onClick={event => {
            event.stopPropagation();
            toggle();
          }}
        >
          {renderOverflowSummary?.(overflowContext) ?? `${context.items.length} entries`}
        </button>
      )}
      {position && (
        <FloatingMenuPanel
          menuRef={menuRef}
          position={position}
          onClose={close}
          className="resource-calendar__overflow-panel"
          width={230}
        >
          <div className="resource-calendar__overflow-heading">
            {context.period.key}
          </div>
          {context.items.map(item => (
            <div className="resource-calendar__overflow-item" key={getItemId(item)}>
              {renderOverflowItem(item, close, close)}
            </div>
          ))}
        </FloatingMenuPanel>
      )}
      {cellMenu.position && <FloatingMenuPanel menuRef={cellMenu.menuRef} position={cellMenu.position} onClose={cellMenu.close} width={180}>
        {cellActions.map(action => <button type="button" role="menuitem" key={action.id} onClick={event => { event.stopPropagation(); cellMenu.close(); action.onSelect(); }}>{action.label}</button>)}
      </FloatingMenuPanel>}
    </div>
  );
}
