import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

/**
 * Plans a collection page, its reference-data hook, and their test outlines without writing files.
 * Rejects paths deeper than one route family or segments that are not PascalCase.
 * @param pagePath - A page name, optionally prefixed by a route family, such as Staff/Schedules.
 * @returns Four formatted source files keyed by their destination paths under pages/.
 * @example pagePlan(context, 'Staff/Schedules') // Plans Schedules.tsx, useSchedulesData.ts, and their tests.
 */
export function pagePlan(context: ScaffoldContext, pagePath: string): ScaffoldPlan {
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
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    import PageContainer from '${pageContainerImport}';
    import type { PageMessageValue } from '${context.relativeImport(directory, join(context.frontendRoot, 'common/components/PageMessageOverlay/PageMessageOverlay'))}';
    import ${hookName} from './hooks/data/${hookName}';

    export default function ${name}() {
      // TODO: Page-local message state.

      // TODO: Permissions and application services.

      // Page data.
      ${hookName}();
      // TODO: Pass loaded options to preferences and page children.

      // TODO: Saved preferences, when this page has durable controls.
      // Use a page hook backed by usePreferences; follow docs/frontend/architecture/preferences.md.
      // Return grouped search, filters, and table controls, with ready/error at the top level.
      // Build filters with createPreferenceFilters; definition IDs match filters.values keys.
      // Pass the hook result as controls={controls} to PageContainer; it gates controls and content.
      // While controls.ready is false, cards and views stay unmounted; actions and messages remain available.
      // Supply search labels/placeholders and column definitions separately; the container connects state.
      // Keep view/setView at the top level when multiple views are supported.

      // TODO: Filter configuration passed to every page data view.
      // Define one named stable object from applied search and filters; children add only view inputs.

      // TODO: Selection and page-spanning actions.

      // TODO: Modal and confirmation workflows.

      // TODO: Table, calendar, and dashboard configuration.
      const dashboard = <p>${name} dashboard</p>;
      const primaryView = <p>${name} content</p>;

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
    export default function ${hookName}() {
      // TODO: Group page-wide reference queries and existing domain hooks here.
      // Preserve each query's key, cancellation, loading, and error state.
      // Table and calendar collection queries stay with their view owners.
      return {};
    }
    `,
  );
  const hookTest = context.sourceFile(
    join(directory, `hooks/data/${hookName}.test.ts`),
    `
    import { describe, it } from 'vitest';

    describe('${hookName}', () => {
      it.todo('builds page reference query keys and honors enabled conditions');
      it.todo('forwards request inputs and AbortSignal to the API adapters');
      it.todo('exposes each reference source and its loading and error state');
    });
    `,
  );

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(directory, `hooks/data/${hookName}.ts`), hook],
      [join(directory, `hooks/data/${hookName}.test.ts`), hookTest],
    ]),
  };
}
