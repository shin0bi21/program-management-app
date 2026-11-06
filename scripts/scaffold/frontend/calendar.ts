import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

/**
 * Plans a page calendar adapter and test outline without writing files.
 * Rejects unsupported owner paths/names through the shared context validators.
 * @param ownerPath - Repository-relative components directory belonging to a page.
 * @param name - Domain component name ending in Calendar, such as ScheduleCalendar.
 * @returns Formatted component and test sources keyed by their destination paths.
 * @example calendarPlan(context, 'frontend/src/pages/Staff/Schedules/components', 'ScheduleCalendar')
 * // Plans ScheduleCalendar/ScheduleCalendar.tsx and ScheduleCalendar/ScheduleCalendar.test.tsx.
 */
export function calendarPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  const owner = context.pageComponentsOwner(ownerPath, 'Calendar');
  const directory = context.componentOwner(owner, name, 'Calendar', 'Calendar');
  const title = name.replace(/Calendar$/, '');
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    /**
     * Displays a placeholder for the ${title} calendar until its domain data is connected.
     * @example <${name} /> shows the ${title} calendar setup prompt.
     */
    export default function ${name}() {
      // Define domain types, constants, and pure identity/range helpers outside the component.

      // Range loading: loadRange adapts the page filters, period keys, and AbortSignal to the API.
      // Keep server filtering in the API; the page keys this owner by its complete applied filters.

      // Buffer setup: calendar = useDataBuffer, with stable domain identity/range helpers.
      // Forward load cancellation and clip buffered requests to applied domain bounds.
      // Use inclusive item keys and complete overlap records; do not duplicate items per day.

      // Error reporting: retryAction and usePageMessageReporter publish the buffer error and retry.

      // Cache synchronization, when needed: expose upsert/remove through the page cache ref.
      // Destructure upsertItem/removeItem for effect dependencies and expand the cleanup body.

      // Display data: derive visibleResources (or visiblePrograms) and visibleItems only when needed.
      // Keep domain notifications next to the derived data they report.

      // Rendering and interactions: buildItem, getItemCapabilities, domain move/resize handlers,
      // then getCellActions. Name substantial callbacks; leave simple forwarding inline.
      // Forward buildItem's calendar contract into Item; the shared shell owns positioning/interactions.

      // Unavailable state: return the domain UnavailableState before the calendar JSX.

      // Calendar JSX: group layout/periods, rows/selection, items/rendering,
      // item interactions, and cell actions, in that order with blank lines between groups.
      return (
        <section aria-label="${title} calendar">
          TODO: Connect ${title} range data to TimelineCalendar.
        </section>
      );
    }
    `,
  );
  const test = context.sourceFile(
    join(directory, `${name}.test.tsx`),
    `
    // Shared TimelineCalendar tests retain generic rendering, geometry, pointer, focus, and cleanup mechanics.
    import { describe, it } from 'vitest';

    describe('${name}', () => {
      it.todo('allows domain actions only for writable records');
      it.todo('forwards the complete page filters and requested range to the API adapter');
      it.todo('maps supported cell, item, move, and resize callbacks to page actions');
    });
    `,
  );

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
    ]),
  };
}
