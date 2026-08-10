import { useRef, type ReactNode } from 'react';
import FloatingMenuPanel from '../../FloatingMenu/FloatingMenuPanel';
import { useFloatingMenu } from '../../FloatingMenu/hooks/useFloatingMenu';
import type { CalendarCellContext, CellOverflowContext } from '../types';

interface ResourceCalendarCellProps<TResource, TItemData> {
  context: CalendarCellContext<TResource, TItemData>;
  resourceId: string;
  getItemId: (item: TItemData) => string;
  renderItem: (item: TItemData) => ReactNode;
  renderOverflowItem: (item: TItemData, onDragEnd: () => void, closeOverflow: () => void) => ReactNode;
  onCellClick?: (context: CalendarCellContext<TResource, TItemData>) => void;
  maxVisibleItems: number;
  renderOverflowSummary?: (context: CellOverflowContext<TResource, TItemData>) => ReactNode;
}

export default function ResourceCalendarCell<TResource, TItemData>({
  context,
  resourceId,
  getItemId,
  renderItem,
  renderOverflowItem,
  onCellClick,
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
  const visibleItems = hasOverflow ? [] : context.items;
  const overflowContext = { ...context, itemCount: context.items.length };

  return (
    <div
      className={`resource-calendar__cell${onCellClick ? ' resource-calendar__cell--interactive' : ''}`}
      data-period={context.period.key}
      data-resource-id={resourceId}
      role={onCellClick ? 'gridcell' : undefined}
      tabIndex={onCellClick ? 0 : undefined}
      onClick={onCellClick ? () => onCellClick(context) : undefined}
      onKeyDown={onCellClick ? event => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onCellClick(context);
      } : undefined}
      aria-label={onCellClick ? `Add item for ${context.period.key}` : undefined}
    >
      {visibleItems.map(item => <div key={getItemId(item)}>{renderItem(item)}</div>)}
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
    </div>
  );
}
