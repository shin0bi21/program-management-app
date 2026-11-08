/**
 * Builds table and component-owned data outlines in memory without writing files.
 * Flow:
 * 1. Validate the page component owner and table name.
 * 2. Format component, table-index data hook, and test outlines.
 * 3. Return component and component-hook destinations for shared publication.
 */
import { basename, dirname, join } from 'node:path';

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
  const pageName = basename(dirname(owner));
  const dataName = `${pageName[0].toLowerCase()}${pageName.slice(1)}Data`;
  const dataDirectory = join(directory, 'hooks');
  const pageDataImport = context.relativeImport(directory, join(dirname(owner), `hooks/data/use${pageName}Data`));
  const hookPageDataImport = context.relativeImport(dataDirectory, join(dirname(owner), `hooks/data/use${pageName}Data`));
  // 2. Format the component source without writing destination files.
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    import ${hookName} from '${context.relativeImport(directory, join(dataDirectory, hookName))}';
    import type { ${pageName}Data } from '${pageDataImport}';

    /**
     * Displays a placeholder for the ${title} collection until shared Table wiring is implemented.
     * @param props.data - Main records and reference context supplied by the page.
     * @example <${name} data={data} /> displays the table integration prompt.
     */
    export default function ${name}({ data }: { data: ${pageName}Data }) {
      const table = ${hookName}(data);

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
    import type { RecordListIndex } from '${context.relativeImport(dataDirectory, join(context.frontendRoot, 'query/createRecordStore'))}';
    import type { ${pageName}Data } from '${hookPageDataImport}';

    /**
     * Resolves current ${title} records from the table's membership and ordering indexes.
     * @param data - Main records and reference context supplied by the page.
     * @returns An empty row list with loading disabled; no request is made yet.
     * @example ${hookName}(data) returns { rows: [], loading: false }.
     */
    export default function ${hookName}(data: ${pageName}Data) {
      const { records } = data;
      // TODO: Replace this empty index with useInfiniteListQuery<RecordListIndex>.
      const indexes: RecordListIndex[] = [];
      // Own table inputs and membership here; ${dataName} owns complete saved records.
      // Around the real API read, use ${dataName}.beginRead(client), then
      // ${dataName}.finishRead(client, read, page.rows, signal); return only ID/sortValue indexes.
      // Use useInfiniteListQuery under a table-only prefix, separate from lookups/aggregates.
      // Forward signal/cursor and TABLE_PAGE_SIZE; server filtering/sorting precedes pagination.
      // Report initial/refresh/next-page errors with their matching retry through usePageMessageReporter.
      // Publish complete mutations through ${dataName}; its loaded table indexes retain membership.
      // Supply ordering and expose refreshNotice for a user-requested first-page refresh.
      return {
        rows: indexes.flatMap(({ id }) => records[id] ? [records[id]] : []),
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
    join(dataDirectory, `${hookName}.test.ts`),
    `
    // This hook owns adapter inputs, query identity, and domain row shaping.
    // useInfiniteListQuery owns accumulation, loading, refresh, and retry mechanics.
    import { describe, it } from 'vitest';

    describe('${hookName}', () => {
      it.todo('builds the complete domain query key and honors enabled gates');
      it.todo('forwards filters, sorting, page size, cursor, and AbortSignal to the API adapter');
      it.todo('publishes domain responses through the main owner and resolves indexed rows');
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
