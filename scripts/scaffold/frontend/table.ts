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
  const owner = context.pageComponentsOwner(ownerPath, 'Table');
  const directory = context.componentOwner(owner, name, 'Table', 'Table');
  const hookName = `use${name}Data`;
  const title = name.replace(/Table$/, '');
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    import ${hookName} from './hooks/${hookName}';

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
  const hook = context.sourceFile(
    join(directory, `hooks/${hookName}.ts`),
    `
    /**
     * Supplies empty ${title} rows until the domain cursor query is implemented.
     * @returns An empty row list with loading disabled; no request is made yet.
     * @example ${hookName}() returns { rows: [], loading: false }.
     */
    export default function ${hookName}() {
      // TODO: Own the domain query key, inputs, row shaping, and cursor adapter here.
      // Use useInfiniteListQuery under a table-only prefix, separate from lookups/aggregates.
      // Forward signal/cursor and TABLE_PAGE_SIZE; server filtering/sorting precedes pagination.
      // Report initial/refresh/next-page errors with their matching retry through usePageMessageReporter.
      // Reconcile authoritative edits/deletes with infiniteListCache; keep edited rows in place.
      // Supply ordering and expose refreshNotice for a user-requested first-page refresh.
      return {
        rows: [],
        loading: false,
      };
    }
    `,
  );
  const test = context.sourceFile(
    join(directory, `${name}.test.tsx`),
    `
    // Test domain cells, actions, and selection wiring here; shared Table owns rendering,
    // sorting controls, resizing, and scroll triggers. The query hook owns page fetching.
    // Pure policies own eligibility matrices.
    import { describe, it } from 'vitest';

    describe('${name}', () => {
      it.todo('renders domain cell values for the loaded records');
      it.todo('invokes row actions for the correct record only when permitted');
      it.todo('forwards the selected record and its selection event to the page');
    });
    `,
  );
  const hookTest = context.sourceFile(
    join(directory, `hooks/${hookName}.test.ts`),
    `
    // This hook owns adapter inputs, query identity, and domain row shaping.
    // useInfiniteListQuery owns accumulation, loading, refresh, and retry mechanics.
    import { describe, it } from 'vitest';

    describe('${hookName}', () => {
      it.todo('builds the complete domain query key and honors enabled gates');
      it.todo('forwards filters, sorting, page size, cursor, and AbortSignal to the API adapter');
      it.todo('returns only domain-specific row shaping added by this hook');
    });
    `,
  );

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(directory, `hooks/${hookName}.ts`), hook],
      [join(directory, `hooks/${hookName}.test.ts`), hookTest],
    ]),
  };
}
