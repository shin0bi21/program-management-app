import { join } from 'node:path';

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
  // 2. Format the component source without writing destination files.
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    export default function ${name}() {
      // Cards own private queries; receive shared page data through props.
      // Add a dashboard data hook only for queries shared by sibling cards.
      // Name extracted cards *DashboardCard and use the shared DashboardCard shell.
      // Pass this fragment to PageContainer's dashboard slot; keep page-wide actions in its header.
      // Distinguish no selection, loading, empty, failure/retry, and same-target refresh.
      return (
        <>
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
