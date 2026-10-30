import { useCallback, useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import type { ColumnSizingInfoState, ColumnSizingState, Header, Updater } from '@tanstack/react-table';
import { MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, clampColumnWidth } from '../table.utils';

const EMPTY_INFO: ColumnSizingInfoState = {
  startOffset: null, startSize: null, deltaOffset: null, deltaPercentage: null,
  isResizingColumn: false, columnSizingStart: [],
};

type ResizeEvent = MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>;

interface ResizeSession {
  id: string;
  widths: ColumnSizingState;
  width: number;
  left: number;
  scrollLeft: number;
  viewport: HTMLDivElement;
  clamp: (width: number) => number;
  controller: AbortController;
}

/** Stages rendered widths while TanStack owns drag offsets and release timing. */
export default function useTableResize(
  onCommit: (widths: ColumnSizingState) => void,
  getMinimumWidth?: (columnId: string, widths: ColumnSizingState) => number,
  enabled = true,
) {
  const session = useRef<ResizeSession | null>(null);
  const infoRef = useRef(EMPTY_INFO);
  const [info, setInfo] = useState(EMPTY_INFO);
  const [guide, setGuide] = useState<{ left: number; top: number; height: number }>();

  function previewWidth(current: ResizeSession) {
    return current.clamp(current.width + (infoRef.current.deltaOffset ?? 0)
      + current.viewport.scrollLeft - current.scrollLeft);
  }

  function updateGuide() {
    const current = session.current;
    if (!current) return;
    setGuide({
      left: current.left + previewWidth(current),
      top: current.viewport.scrollTop,
      height: current.viewport.clientHeight,
    });
  }

  const cancel = useCallback(() => {
    session.current?.controller.abort();
    session.current = null;
    infoRef.current = EMPTY_INFO;
    setInfo(EMPTY_INFO);
    setGuide(undefined);
  }, []);

  useEffect(() => () => { session.current?.controller.abort(); }, []);
  useEffect(() => { if (!enabled) cancel(); }, [enabled, cancel]);

  function onSizingInfoChange(updater: Updater<ColumnSizingInfoState>) {
    const next = typeof updater === 'function' ? updater(infoRef.current) : updater;
    infoRef.current = next;
    setInfo(next);
    if (!next.isResizingColumn) cancel();
    else updateGuide();
  }

  function commitResize(): boolean {
    const current = session.current;
    if (!current) return false;
    onCommit({ ...current.widths, [current.id]: previewWidth(current) });
    return true;
  }

  function startResize<T>(header: Header<T, unknown>, event: ResizeEvent, widths: ColumnSizingState, viewport: HTMLDivElement) {
    if (session.current || ('touches' in event ? event.touches.length !== 1 : event.button !== 0)) return;
    const cell = event.currentTarget.closest('th')!;
    const controller = new AbortController();
    const document = cell.ownerDocument;
    const { minSize = MIN_COLUMN_WIDTH, maxSize = MAX_COLUMN_WIDTH } = header.column.columnDef;
    session.current = {
      id: header.column.id, widths, width: widths[header.column.id],
      left: cell.getBoundingClientRect().left - viewport.getBoundingClientRect().left - viewport.clientLeft + viewport.scrollLeft,
      scrollLeft: viewport.scrollLeft, viewport, controller,
      clamp: width => clampColumnWidth(width, Math.max(minSize, getMinimumWidth?.(header.column.id, widths) ?? minSize), maxSize),
    };

    // Scope TanStack's document listeners to this gesture so cancellation and unmount remove them.
    // Touchend has no remaining touches; pass its changed touch to TanStack's release handler.
    const context = {
      addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions | boolean) {
        document.addEventListener(type, type === 'touchend' ? (event: Event) => {
          const touch = event as globalThis.TouchEvent;
          listener({ touches: touch.changedTouches, cancelable: false } as unknown as Event);
        } : listener, { ...(typeof options === 'object' ? options : {}), signal: controller.signal });
      },
      removeEventListener(type: string, listener: EventListener) { document.removeEventListener(type, listener); },
    } as Document;
    document.addEventListener('touchcancel', cancel, { signal: controller.signal });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') cancel(); }, { signal: controller.signal });
    document.defaultView?.addEventListener('blur', cancel, { signal: controller.signal });
    viewport.addEventListener('scroll', updateGuide, { signal: controller.signal });
    header.getResizeHandler(context)(event);
  }

  return { info, guide, onSizingInfoChange, commitResize, startResize };
}
