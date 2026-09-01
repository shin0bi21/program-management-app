import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

export function pagePlan(context: ScaffoldContext, pagePath: string): ScaffoldPlan {
  const parts = pagePath.split('/');
  if (parts.length < 1 || parts.length > 2) {
    throw new Error('Page path must contain a page name with at most one route family.');
  }
  parts.forEach(part => context.assertPascalCase(part, 'Each page path segment'));

  const name = parts[parts.length - 1];
  const directory = join(context.frontendRoot, 'pages', ...parts);

  const pageHeaderImport = context.relativeImport(
    directory,
    join(context.frontendRoot, 'common/components/PageHeader/PageHeader'),
  );
  const pageBodyImport = context.relativeImport(
    directory,
    join(context.frontendRoot, 'common/components/PageBody/PageBody'),
  );
  const component = context.sourceFile(join(directory, `${name}.tsx`), `
import PageBody from '${pageBodyImport}';
import PageHeader from '${pageHeaderImport}';

export default function ${name}() {
  // TODO: Page-local error state.

  // TODO: Permissions and application services.

  // TODO: Page data and preferences.

  // TODO: Selection and page-spanning actions.

  // TODO: Modal and confirmation workflows.

  // TODO: Table, calendar, dashboard, and body initialization.
  const dashboard = <p>${name} dashboard</p>;
  const primaryView = <p>${name} content</p>;

  // TODO: Derived errors and presentation state.

  // Render.
  return (
    <main className="page-container page-container--data">
      <PageHeader title="${name}" />
      <PageBody
        ariaLabel="${name} overview"
        dashboard={dashboard}
        table={primaryView}
      />
    </main>
  );
}
`);
  const test = context.sourceFile(join(directory, `${name}.test.tsx`), `
// Replace these placeholders with route-owned orchestration tests; child owners retain their internal matrices.
import { describe, it } from 'vitest';

describe('${name}', () => {
  it.todo('wires permissions, restored controls, selected context, views, and dialog entry paths');
  it.todo('connects cross-owner callbacks without repeating child behavior');
});
`);

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
    ]),
  };
}
