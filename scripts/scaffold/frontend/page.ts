/**
 * Builds collection-page source outlines in memory; this module does not write files.
 * Flow:
 * 1. Validate page segments and derive the page/data destinations.
 * 2. Format route, main record owner, and test outlines.
 * 3. Return the plan for the CLI's shared conflict checks and publication.
 */
import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

/**
 * Plans a collection page, its saved-record data owner, and their test outlines without writing files.
 * Rejects paths deeper than one route family or segments that are not PascalCase.
 * @param pagePath - A page name, optionally prefixed by a route family, such as Staff/Schedules.
 * @returns Four formatted source files keyed by their destination paths under pages/.
 * @example pagePlan(context, 'Staff/Schedules') // Plans Schedules.tsx, useSchedulesData.ts, and their tests.
 */
export function pagePlan(context: ScaffoldContext, pagePath: string): ScaffoldPlan {
  // 1. Validate the requested owner and derive destination names.
  const parts = pagePath.split('/');
  if (parts.length < 1 || parts.length > 2) {
    throw new Error('Page path must contain a page name with at most one route family.');
  }
  parts.forEach(part => context.assertPascalCase(part, 'Each page path segment'));

  const name = parts[parts.length - 1];
  const directory = join(context.frontendRoot, 'pages', ...parts);
  const hookName = `use${name}Data`;
  const dataName = `${name[0].toLowerCase()}${name.slice(1)}Data`;
  const queryPrefix = parts.map(part => `'${part[0].toLowerCase()}${part.slice(1)}'`).join(', ');
  const dataDirectory = join(directory, 'hooks/data');

  const pageContainerImport = context.relativeImport(
    directory,
    join(context.frontendRoot, 'common/components/PageContainer/PageContainer'),
  );
  // 2. Format the component source without writing destination files.
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    import PageContainer from '${pageContainerImport}';
    import type { PageMessageValue } from '${context.relativeImport(directory, join(context.frontendRoot, 'common/components/PageMessageOverlay/PageMessageOverlay'))}';
    import ${hookName} from './hooks/data/${hookName}';

    /**
     * Composes the ${name} collection route around its saved-record data owner.
     * @example <${name} /> // page controls, views, and selected-record workflows
     */
    export default function ${name}() {
      // TODO: Page-local message state.

      // TODO: Permissions and application services.

      // Page data.
      const data = ${hookName}();
      // TODO: Pass data to table/calendar components and dashboard cards through props or context.
      // Resolve selected IDs through data.records; do not call this hook again in descendants.
      // Consume the main data hook's reference results before restoring preferences.

      // TODO: Saved preferences, when this page has durable controls.
      // Use a page hook backed by usePreferences; follow docs/frontend/03-preferences.md.
      // Return grouped search, filters, and table controls, with ready/error at the top level.
      // Build filters with createPreferenceFilters; definition IDs match filters.values keys.
      // Pass the hook result as controls={controls} to PageContainer; it gates controls and content.
      // While controls.ready is false, cards and views stay unmounted; actions and messages remain available.
      // Supply search labels/placeholders and column definitions separately; the container connects state.
      // Keep view/setView at the top level when multiple views are supported.

      // TODO: Filter configuration passed to every page data view.
      // Define one named stable object from applied search and filters; children add only view inputs.

      // TODO: Selection and page-spanning actions.
      // Retain selected IDs across filters; resolve records[id], never keep a saved-record copy.
      // Dashboard cards query selected IDs for summaries/children they own.
      // Publish complete mutation responses through ${dataName}; capture its account scope before awaiting.
      // Keep each editable draft in its form, initialized only when its target identity changes.

      // TODO: Modal and confirmation workflows.

      // TODO: Table, calendar, and dashboard configuration.
      const dashboard = <p>${name} dashboard</p>;
      const primaryView = <p data-loaded-records={Object.keys(data.records).length}>${name} content</p>;

      // TODO: Derived messages and presentation state.
      const pageMessages: PageMessageValue[] = [];

      // Render.
      return (
        <PageContainer
          title="${name}"
          ariaLabel="${name} overview"
          messages={pageMessages}
          dashboard={dashboard}
          table={primaryView}
        />
      );
    }
    `,
  );
  // 3. Format the companion sources and colocated test outlines.
  const test = context.sourceFile(
    join(directory, `${name}.test.tsx`),
    `
    import { describe, it } from 'vitest';

    // Follow docs/workflows/delivery/testing.md for test ownership and assertions.
    describe('${name}', () => {
      // Entry and readiness.
      it.todo('shows only the page actions allowed by the current permissions');
      it.todo('waits for domain reference dependencies before restoring saved controls');

      // Rendered states.
      it.todo('reports page-owned failures through the shared message overlay');

      // Controls and views.
      it.todo('applies search and filters to each active data view');
      it.todo('connects restored domain controls to the intended data inputs');

      // Selection and coordination.
      it.todo('shares selected context across page views');
      it.todo('reconciles selected context after a page-owned action');

      // Commands and dialogs.
      it.todo('opens page-owned dialogs from their public entry points');
      it.todo('connects confirmed actions to the owning page workflow');
    });
    `,
  );

  const hook = context.sourceFile(
    join(directory, `hooks/data/${hookName}.ts`),
    `
    import { createRecordStore } from '${context.relativeImport(dataDirectory, join(context.frontendRoot, 'query/createRecordStore'))}';

    // TODO: Replace this ID-only scaffold with the complete domain API record type.
    export interface ${name}Record { id: string }

    export interface ${name}Data {
      records: Readonly<Record<string, ${name}Record>>;
      // TODO: Add shared reference rows and their loading/error states when this page needs them.
    }

    export const ${dataName} = createRecordStore<${name}Record>({
      queryKey: [${queryPrefix}, 'records'],
      listKey: [${queryPrefix}, 'table'],
      // TODO: Supply the actual server-compatible sort projection for this domain's table keys.
      getSortValue: () => { throw new Error('Implement domain table ordering before loading records.'); },
    });

    /**
     * Supplies the page's saved ${name} records and shared reference lookups.
     * Descendants receive this data through props/context; their hooks own view requests and membership.
     * @example const { records } = ${hookName}() // resolve selected IDs without fetching again
     */
    export default function ${hookName}(): ${name}Data {
      // TODO: Compose required page-wide reference hooks once, preserving loading/error/cancellation.
      // Add a separate reference hook only when that composition has a distinct reusable responsibility.
      return { records: ${dataName}.useRecords() };
    }
    `,
  );
  const hookTest = context.sourceFile(
    join(directory, `hooks/data/${hookName}.test.ts`),
    `
    import { describe, it } from 'vitest';

    describe('${hookName}', () => {
      // Complete domain-specific projections here; createRecordStore owns revision/account mechanics.
      it.todo('maps domain sort columns to their server-compatible values');
      // Keep cases only for reference sources this page actually composes.
      it.todo('exposes required reference rows with their loading and error states');
      it.todo('applies domain inputs and enabled gates to composed reference hooks');
    });
    `,
  );

  // 4. Return all sources together for conflict validation and publication.
  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(directory, `hooks/data/${hookName}.ts`), hook],
      [join(directory, `hooks/data/${hookName}.test.ts`), hookTest],
    ]),
  };
}
