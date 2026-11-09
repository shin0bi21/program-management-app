/**
 * Builds calendar range-buffer outlines in memory without writing files.
 * Flow:
 * 1. Validate the page component owner and calendar name.
 * 2. Format calendar range-buffer prompts and its test outline.
 * 3. Return the component destinations for shared publication.
 */
import { basename, dirname, join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

/**
 * Plans a page calendar range adapter and test outline without writing files.
 * Rejects unsupported owner paths/names through the shared context validators.
 * @param ownerPath - Repository-relative components directory belonging to a page.
 * @param name - Domain component name ending in Calendar, such as ScheduleCalendar.
 * @returns Formatted component and test sources keyed by their destination paths.
 * @example calendarPlan(context, 'frontend/src/pages/Staff/Schedules/components', 'ScheduleCalendar')
 * // Plans ScheduleCalendar.tsx and its colocated test.
 */
export function calendarPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  // 1. Validate the requested owner and derive destination names.
  const owner = context.pageComponentsOwner(ownerPath, 'Calendar');
  const directory = context.componentOwner(owner, name, 'Calendar', 'Calendar');
  const title = name.replace(/Calendar$/, '');
  const pageName = basename(dirname(owner));
  const pageDataImport = context.relativeImport(directory, join(dirname(owner), `hooks/data/use${pageName}Data`));
  // 2. Format the component source without writing destination files.
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    import type { ${pageName}Data } from '${pageDataImport}';

    /**
     * Displays a placeholder for the ${title} calendar until its domain data is connected.
     * @param props.data - Reference context supplied by the page.
     * @example <${name} data={data} /> shows the ${title} calendar setup prompt.
     */
    export default function ${name}({ data }: { data: ${pageName}Data }) {
      // Define domain types, constants, and pure identity/range helpers outside the component.

      // Own the range adapter/useDataBuffer here, or extract a private hooks/use${name}Data.
      // Receive shared references through data; never call the page's main data hook here.
      // Adapt applied filters, inclusive period keys, and AbortSignal to the real domain API.
      // Buffer complete returned domain rows; keep the API shape for rendering.
      // Forward cancellation, clip requests to applied bounds, and retain complete overlap membership.
      // Keep stable identity/range helpers outside the component; do not duplicate records per day.
      // Publish buffer error/retry with usePageMessageReporter and reconcile membership after mutations.
      // Under PageContainer, pass undefined as its callback argument to use automatic page reporting.
      // A private data hook receives this same context instead of repeating page reference queries.

      // Display data: derive visibleResources (or visiblePrograms) and visibleItems only when needed.
      // Keep domain notifications next to the derived data they report.

      // Rendering and interactions: buildItem, getItemCapabilities, domain move/resize handlers,
      // then getCellActions. Name substantial callbacks; leave simple forwarding inline.
      // Forward buildItem's calendar contract into Item; the shared shell owns positioning/interactions.

      // Unavailable state: return the domain UnavailableState before the calendar JSX.

      // Calendar JSX: group layout/periods, rows/selection, items/rendering,
      // item interactions, and cell actions, in that order with blank lines between groups.
      return (
        <section aria-label="${title} calendar" data-loading={data.loading || undefined}>
          TODO: Connect ${title} range data to TimelineCalendar.
        </section>
      );
    }
    `,
  );
  // 3. Format the companion sources and colocated test outlines.
  const test = context.sourceFile(
    join(directory, `${name}.test.tsx`),
    `
    // Shared TimelineCalendar tests retain generic rendering, geometry, pointer, focus, and cleanup mechanics.
    // Shared page-message suites own aggregation, cleanup, dismissal, severity, and action state.
    // Test only domain message choices and recovery actions here; omit generic reporter callback assertions.
    import { describe, it } from 'vitest';

    describe('${name}', () => {
      it.todo('allows domain actions only for writable records');
      it.todo('forwards the complete page filters, requested range, and AbortSignal to the API adapter');
      it.todo('adapts complete API rows into the calendar range buffer');
      it.todo('maps supported cell, item, move, and resize callbacks to page actions');
    });
    `,
  );

  // 4. Return all sources together for conflict validation and publication.
  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
    ]),
  };
}
