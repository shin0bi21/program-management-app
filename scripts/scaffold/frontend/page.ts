/**
 * Builds collection-page source outlines in memory; this module does not write files.
 * Flow:
 * 1. Validate page segments and derive the page/data destinations.
 * 2. Format the route component outline.
 * 3. Format page tests, the reference data owner, and its test outline.
 * 4. Return the plan for the CLI's shared conflict checks and publication.
 */
import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

/**
 * Plans a collection page, its reference data owner, and their test outlines without writing files.
 * Rejects paths deeper than one route family or segments that are not PascalCase.
 * @param context - Validated frontend destinations and in-memory source formatter.
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
     * Composes the ${name} collection route around its reference data owner.
     * @example <${name} /> // page controls, views, and selected-record workflows
     */
    export default function ${name}() {
      // TODO: Page-owned messages. Descendants report through usePageMessageReporter without callbacks.

      // TODO: Permissions and application services.

      // Page data.
      const data = ${hookName}();
      // TODO: Pass data to table/calendar components and dashboard cards through props or context.
      // Each view owns its ordinary query results; do not call this hook again in descendants.
      // Consume the main data hook's reference results before restoring preferences.

      // TODO: Saved preferences, when this page has durable controls.
      // Use a page hook backed by usePreferences; follow docs/frontend/03-preferences.md.
      // Return grouped search, filters, and table controls, with ready/error at the top level.
      // Also expose typed appliedFilters at the top level for every data view.
      // Persist submitted search with preferenceText alongside other filter fields; SearchInput owns its draft.
      // The hook projects normalized domain filters plus applied search into appliedFilters, without storing a second copy.
      // Build filters with createPreferenceFilters; definition IDs match filters.values keys.
      // Pass the hook result as controls={controls} to PageContainer; it gates controls and content.
      // While controls.ready is false, cards and views stay unmounted; actions and messages remain available.
      // Supply search labels/placeholders and column definitions separately; the container connects state.
      // Keep view/setView at the top level when multiple views are supported.

      // TODO: Filter configuration passed to every page data view.
      // Pass controls.appliedFilters directly to tables/calendars; do not merge or append search at the route.
      // Views add sorting, cursors, visible ranges, and cancellation at their own request boundary.
      // The controls hook derives cycle bounds; retain dateRange identity for calendar period construction.

      // TODO: Selection and page-spanning actions.
      // Keep selected IDs and clicked row context needed by page workflows.
      // Dashboard cards query selected IDs for summaries/children they own.
      // Reconcile saved/deleted cursor rows with existing cache helpers; retain positions and offer Refresh for changed sort order.
      // Invalidate affected membership, references, and summary queries when they need reloading.
      // Initialize a mounted form from supplied data for editing or empty defaults for adding.

      // TODO: Modal and confirmation workflows.

      // TODO: Table, calendar, and dashboard configuration.
      // Pass dashboard cards directly to PageContainer; it collects their messages and supplies the grid.
      const dashboard = <p>${name} dashboard</p>;
      const primaryView = <p data-loading={data.loading || undefined}>${name} content</p>;

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
    // Order: imports, typed child boundaries, fixtures, per-test setup, then the behavior groups below.
    // Keep page controls, selection, actions, and PageContainer real; observe public props when needed.
    // Invoke control callbacks to check domain inputs; shared controls own filter/search/view UI sequences.
    // Use small ComponentProps-typed child stubs for inputs/events without copying child behavior.
    // Keep existing representative coordination checks; do not add scenarios just to fill this outline.
    // Shared page-message suites own aggregation, cleanup, dismissal, severity, and action state.
    // Test only domain message choices and recovery actions here; omit generic reporter callback assertions.
    describe('${name}', () => {
      // Entry and readiness.
      it.todo('shows only the page actions allowed by the current permissions');
      it.todo('waits for domain reference dependencies before restoring saved controls');
      it.todo('connects a page-owned failure to its domain recovery action');

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
    // Put local render and interaction helpers below the suite in caller order.
    // Each test starts with fresh state; consolidate page-owned setup/actions without hiding assertions.
    `,
  );

  const hook = context.sourceFile(
    join(directory, `hooks/data/${hookName}.ts`),
    `
    export interface ${name}Data {
      loading: boolean;
      error: Error | null;
      // TODO: Add shared reference rows when this page needs them.
    }

    /**
     * Supplies shared ${name} reference lookups used by page controls and children.
     * Descendants receive reference context; each view owns its query results.
     * @example const { loading, error } = ${hookName}()
     */
    export default function ${hookName}(): ${name}Data {
      // TODO: Compose required page-wide reference hooks once, preserving loading/error/cancellation.
      // Add a separate reference hook only when that composition has a distinct reusable responsibility.
      return { loading: false, error: null };
    }
    `,
  );
  const hookTest = context.sourceFile(
    join(directory, `hooks/data/${hookName}.test.ts`),
    `
    import { describe, it } from 'vitest';

    describe('${hookName}', () => {
      // Keep cases only for added domain decisions or transformations, not unchanged reference aliases.
      // Remove this test outline when the hook only forwards shared reference results.
      // Shared reference hooks own request defaults, cancellation, cache, loading, and retry mechanics.
      it.todo('derives domain reference choices from the composed records');
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
