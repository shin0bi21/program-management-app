/**
 * Builds selected-record dashboard composition outlines without writing files.
 * Flow:
 * 1. Validate the page component owner and dashboard name.
 * 2. Format selected-ID composition and coordination-test outlines.
 * 3. Return the component destinations without creating optional query wrappers.
 */
import { basename, dirname, join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

/**
 * Plans a page-owned dashboard composition and test outline without writing files.
 * Rejects unsupported owner paths/names through the shared context validators.
 * @param ownerPath - A root or route-family page's components directory, relative to the repository root.
 * @param name - A PascalCase component name with a domain prefix before Dashboard.
 * @returns Component and test source keyed by their destination paths.
 * @example dashboardPlan(context, 'frontend/src/pages/Staff/Schedules/components', 'ScheduleDashboard') // Plans ScheduleDashboard.tsx and ScheduleDashboard.test.tsx.
 */
export function dashboardPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  // 1. Validate the requested owner and derive destination names.
  const owner = context.pageComponentsOwner(ownerPath, 'Dashboard');
  const directory = context.componentOwner(owner, name, 'Dashboard', 'Dashboard');
  const title = name.replace(/Dashboard$/, '');
  const pageName = basename(dirname(owner));
  const pageDataImport = context.relativeImport(directory, join(dirname(owner), `hooks/data/use${pageName}Data`));
  // 2. Format the component source without writing destination files.
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    import type { ${pageName}Data } from '${pageDataImport}';

    /**
     * Composes ${title} cards for the selected saved-record ID.
     * @param props.selectedId - Current selected record, or null when nothing is selected.
     * @param props.data - Current main records and references supplied by the page.
     * @example <${name} selectedId={selectedId} data={data} />
     */
    export default function ${name}({ selectedId, data }: { selectedId: string | null; data: ${pageName}Data }) {
      // Cards own private summary/child queries keyed by selectedId; disable them when it is null.
      // Read main-record fields from supplied data; do not repeat the page's main/reference queries.
      // Add a private use<Domain>DashboardData only for queries shared by sibling cards.
      // Keep API calls out of this composition and avoid an empty dashboard-data wrapper.
      // Name extracted cards *DashboardCard and use the shared DashboardCard shell.
      // Pass this fragment to PageContainer's dashboard slot; keep page-wide actions in its header.
      // Pass selectedId/data to the cards that need them; resource-summary cards may be independent.
      // Each card handles its own no-selection, missing record, loading, failure/retry, and refresh states.

      return (
        <>
          {/* TODO: Pass selectedId and data to the applicable cards without gating the whole dashboard. */}
          TODO: Compose the ${title} dashboard cards.
        </>
      );
    }
    `,
  );
  // 3. Format the companion sources and colocated test outlines.
  const test = context.sourceFile(
    join(directory, `${name}.test.tsx`),
    `
    // Cards own private queries and actions; test only coordination added by the dashboard.
    import { describe, it } from 'vitest';

    describe('${name}', () => {
      it.todo('routes a card action to the currently selected record');
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
