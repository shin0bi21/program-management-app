/**
 * Builds table and component-owned data outlines in memory without writing files.
 * Flow:
 * 1. Validate the page component owner and table name.
 * 2. Format component, table data hook, and test outlines.
 * 3. Return component and component-hook destinations for shared publication.
 */
import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

/**
 * Plans a page-owned table, cursor-data hook, and test outlines without writing files.
 * Rejects unsupported owner paths/names through the shared context validators.
 * @param ownerPath - Root or route-family page components directory, relative to the repository.
 * @param name - PascalCase component name with a domain prefix and Table suffix.
 * @returns Four formatted source files keyed by their destination paths.
 * @example tablePlan(context, 'frontend/src/pages/Staff/Schedules/components', 'ScheduleTable')
 * // Plans ScheduleTable.tsx, hooks/useScheduleTableData.ts, and their tests.
 */
export function tablePlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  // 1. Validate the requested owner and derive destination names.
  const owner = context.pageComponentsOwner(ownerPath, 'Table');
  const directory = context.componentOwner(owner, name, 'Table', 'Table');
  const hookName = `use${name}Data`;
  const title = name.replace(/Table$/, '');
  const dataDirectory = join(directory, 'hooks');
  // 2. Format the component source without writing destination files.
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    import ${hookName} from '${context.relativeImport(directory, join(dataDirectory, hookName))}';

    /**
     * Displays a placeholder for the ${title} collection until shared Table wiring is implemented.
     * @example <${name} /> displays the table integration prompt.
     */
    export default function ${name}() {
      const table = ${hookName}();

      return (
        <section aria-label="${title} table" data-loading={table.loading || undefined}>
          TODO: Connect the ${title} collection to the shared Table.
        </section>
      );
    }
    `,
  );
  // 3. Format the companion sources and colocated test outlines.
  const hook = context.sourceFile(
    join(dataDirectory, `${hookName}.ts`),
    `
    // TODO: Replace this outline with the complete domain API row type.
    interface ${title}Row { id: string }

    /**
     * Supplies complete ${title} rows for the table's applied controls.
     * @returns An empty row list with loading disabled; no request is made yet.
     * @example ${hookName}() returns { rows: [], loading: false }.
     */
    export default function ${hookName}() {
      // TODO: Use useInfiniteListQuery<${title}Row> under a table-only query prefix.
      // Receive applied filters/sorting and any required page reference context as arguments.
      // Cache complete API rows directly; do not create a normalized record store.
      // Forward signal/cursor and TABLE_PAGE_SIZE; server filtering/sorting precedes pagination.
      // Report initial/refresh/next-page errors with their matching retry through usePageMessageReporter.
      // Under PageContainer, pass undefined as its callback argument to use automatic page reporting.
      // Replace saved rows or remove deleted rows with the existing cursor-list cache helpers.
      // Retain positions after sort edits; tableRefreshMessage supplies the out-of-order message and Refresh.
      // Invalidate when creation or changed filter membership requires reloading.
      // Supply ordering and expose refreshNotice for a user-requested first-page refresh.
      const rows: ${title}Row[] = [];
      return { rows, loading: false };
    }
    `,
  );
  const test = context.sourceFile(
    join(directory, `${name}.test.tsx`),
    `
    // Test domain cells, actions, and selection wiring here; shared Table owns rendering,
    // sorting controls, resizing, and scroll triggers. The query hook owns page fetching.
    // Pure policies own eligibility matrices.
    // Shared page-message suites own aggregation, cleanup, dismissal, severity, and action state.
    // Test only domain message choices and recovery actions here; omit generic reporter callback assertions.
    import { describe, it } from 'vitest';

    describe('${name}', () => {
      it.todo('renders domain cell values for the loaded records');
      it.todo('invokes row actions for the correct record only when permitted');
      it.todo('forwards the selected record and its selection event to the page');
    });
    `,
  );
  const hookTest = context.sourceFile(
    join(dataDirectory, `${hookName}.test.ts`),
    `
    // This hook owns adapter inputs, query identity, and domain row shaping.
    // useInfiniteListQuery owns accumulation, loading, refresh, and retry mechanics.
    import { describe, it } from 'vitest';

    describe('${hookName}', () => {
      it.todo('builds the complete domain query key and honors enabled gates');
      it.todo('forwards filters, sorting, page size, cursor, and AbortSignal to the API adapter');
      it.todo('returns complete domain rows from the query');
    });
    `,
  );

  // 4. Return all sources together for conflict validation and publication.
  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(dataDirectory, `${hookName}.ts`), hook],
      [join(dataDirectory, `${hookName}.test.ts`), hookTest],
    ]),
  };
}
