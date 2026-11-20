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
 * Plans a collection page, reference data owner, and their test outlines without writing files.
 * Rejects paths deeper than one route family or segments that are not PascalCase.
 * @param context - Validated frontend destinations and in-memory source formatter.
 * @param pagePath - A page name, optionally prefixed by a route family, such as Staff/Schedules.
 * @returns Formatted source files keyed by their destination paths under pages/.
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

  // 2. Format the route and its test outline.
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    import type { ReactElement } from 'react';
    import PageContainer from '${pageContainerImport}';
    import ${hookName} from './hooks/data/${hookName}';

    /**
     * Coordinates shared ${name} context and supplies the collection page layout.
     * @example <${name} />
     */
    export default function ${name}(): ReactElement {
      const pageData = ${hookName}();
      // TODO: Set up page controls, selection, actions, and messages as needed.
      // TODO: Pass domain context to dashboard cards and body views that need it.
      return <PageContainer
        title="${name}"
        ariaLabel="${name} overview"
        table={<p>{pageData.loading ? 'Loading…' : 'TODO: Add the ${name} table.'}</p>}
      />;
    }
    `,
  );
  const test = context.sourceFile(
    join(directory, `${name}.test.tsx`),
    `
    import { describe, it } from 'vitest';

    // Follow docs/workflows/delivery/testing.md#test-ownership.
    describe('${name}', () => {
      it.todo('covers page-owned controls, selection, and coordination where applicable');
    });
    `,
  );

  // 3. Format shared reference data and its test outline.
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
      // TODO: Compose the shared reference lookups this page needs.
      return { loading: false, error: null };
    }
    `,
  );
  const hookTest = context.sourceFile(
    join(directory, `hooks/data/${hookName}.test.ts`),
    `
    import { describe, it } from 'vitest';

    describe('${hookName}', () => {
      // Remove this outline if the hook adds no domain behavior to shared lookups.
      it.todo('covers page-owned reference decisions');
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
