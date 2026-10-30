import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

export function calendarPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  const owner = context.pageComponentsOwner(ownerPath, 'Calendar');
  const directory = context.componentOwner(owner, name, 'Calendar', 'Calendar');
  const title = name.replace(/Calendar$/, '');
  const component = context.sourceFile(join(directory, `${name}.tsx`), `
export default function ${name}() {
  // Range loading: loadRange adapts the page filters, period keys, and AbortSignal to the API.
  // Keep server filtering in the API; the page keys this owner by its complete applied filters.

  // Buffer setup: calendar = useDataBuffer, with stable domain identity/range helpers.

  // Error reporting: retryAction and usePageMessageReporter publish the buffer error and retry.

  // Cache synchronization, when needed: expose upsert/remove through the page cache ref.
  // Destructure upsertItem/removeItem for effect dependencies and expand the cleanup body.

  // Display data: derive visibleResources (or visiblePrograms) and visibleItems only when needed.
  // Keep domain notifications next to the derived data they report.

  // Rendering and interactions: buildItem, getItemCapabilities, domain move/resize handlers,
  // then getCellActions. Name substantial callbacks; leave simple forwarding inline.

  // Unavailable state: return the domain UnavailableState before the calendar JSX.

  // Calendar JSX: group layout/periods, rows/selection, items/rendering,
  // item interactions, and cell actions, in that order with blank lines between groups.
  return (
    <section aria-label="${title} calendar">
      TODO: Connect ${title} range data to TimelineCalendar.
    </section>
  );
}
`);
  const test = context.sourceFile(join(directory, `${name}.test.tsx`), `
// Shared TimelineCalendar tests retain generic rendering, geometry, pointer, focus, and cleanup mechanics.
import { describe, it } from 'vitest';

describe('${name}', () => {
  it.todo('allows domain actions only for writable records');
  it.todo('forwards the complete page filters and requested range to the API adapter');
  it.todo('maps supported cell, item, move, and resize callbacks to page actions');
});
`);

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
    ]),
  };
}
