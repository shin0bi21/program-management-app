/**
 * Plans a page-owned dashboard card and test outline without writing files.
 * Flow:
 * 1. Validate the page component owner and card name.
 * 2. Format the card and its test outline.
 * 3. Return their destination paths and source.
 */
import { join } from 'node:path';
import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

/**
 * Plans a dashboard card using the shared shell and a colocated test outline.
 * @param ownerPath - A root or route-family page's components directory.
 * @param name - A PascalCase name with a domain prefix before DashboardCard.
 * @returns Component and test source keyed by destination paths.
 * @example dashboardCardPlan(context, 'frontend/src/pages/Staff/Schedules/components', 'ScheduleDashboardCard') // plans the card and test
 */
export function dashboardCardPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  const owner = context.pageComponentsOwner(ownerPath, 'Dashboard card');
  const directory = context.componentOwner(owner, name, 'DashboardCard', 'Dashboard card');
  const shellImport = context.relativeImport(directory, join(context.frontendRoot, 'common/components/DashboardCard/DashboardCard'));
  const componentPath = join(directory, `${name}.tsx`);
  const testPath = join(directory, `${name}.test.tsx`);

  const component = context.sourceFile(componentPath, `
    import { DashboardCard } from '${shellImport}';

    /**
     * Displays this dashboard card's domain summary.
     * @example <${name} />
     */
    export default function ${name}() {
      // TODO: Add the inputs, content, and actions this card needs.
      // Add a private query hook only if the card needs its own data.
      return <DashboardCard title="TODO: Card title">TODO: Card content</DashboardCard>;
    }
  `);
  const test = context.sourceFile(testPath, `
    import { describe, it } from 'vitest';

    describe('${name}', () => {
      it.todo('covers the domain behavior of the card');
    });
  `);

  return { files: new Map([[componentPath, component], [testPath, test]]) };
}
