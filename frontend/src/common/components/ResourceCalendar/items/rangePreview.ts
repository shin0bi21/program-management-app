export interface CalendarPreviewBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getCalendarPreviewBounds(viewport: HTMLElement): CalendarPreviewBounds {
  const bounds = viewport.getBoundingClientRect();
  return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
}

export function getCalendarPreviewHostStyle(bounds: CalendarPreviewBounds) {
  return {
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  };
}

export function createCalendarPreviewHost(viewport: HTMLElement) {
  const bounds = getCalendarPreviewBounds(viewport);
  const host = document.createElement('div');
  host.className = 'resource-calendar__preview-host';
  host.inert = true;
  Object.assign(host.style, getCalendarPreviewHostStyle(bounds));
  document.body.appendChild(host);
  return { host, bounds };
}
