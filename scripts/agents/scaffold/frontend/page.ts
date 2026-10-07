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
  const hookName = `use${name}Data`;

  const pageHeaderImport = context.relativeImport(
    directory,
    join(context.frontendRoot, 'common/components/PageHeader/PageHeader'),
  );
  const pageBodyImport = context.relativeImport(
    directory,
    join(context.frontendRoot, 'common/components/PageBody/PageBody'),
  );
  const pageErrorOverlayImport = context.relativeImport(
    directory,
    join(context.frontendRoot, 'common/components/PageErrorOverlay/PageErrorOverlay'),
  );
  const component = context.sourceFile(join(directory, `${name}.tsx`), `
import PageBody from '${pageBodyImport}';
import PageErrorOverlay from '${pageErrorOverlayImport}';
import PageHeader from '${pageHeaderImport}';
import ${hookName} from './hooks/data/${hookName}';

export default function ${name}() {
  // TODO: Page-local error state.

  // TODO: Permissions and application services.

  // Page data.
  ${hookName}();
  // TODO: Pass loaded options to preferences and page children.

  // TODO: Saved preferences, when this page has durable controls.
  // Use a page hook backed by usePreferences; follow docs/frontend/pages/README.md.
  // Return grouped search, filters, and table controls, with ready/error at the top level.
  // Keep view/setView at the top level when multiple views are supported.

  // TODO: Filter configuration passed to every page data view.

  // TODO: Selection and page-spanning actions.

  // TODO: Modal and confirmation workflows.

  // TODO: Table, calendar, dashboard, and body initialization.
  const dashboard = <p>${name} dashboard</p>;
  const primaryView = <p>${name} content</p>;

  // TODO: Derived errors and presentation state.
  const pageErrors = [];

  // Render.
  return (
    <main className="page-container">
      <PageHeader title="${name}" />
      <PageErrorOverlay errors={pageErrors} />
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
import { describe, it } from 'vitest';

describe('${name}', () => {
  // Page-local error state.
  it.todo('starts without a page-owned error');

  // Permissions and application services.
  it.todo('shows only the page actions allowed by the current permissions');

  // Page data.
  it.todo('shows the page loading state while required data loads');
  it.todo('populates page controls and content from loaded data');

  // Saved preferences and the current view.
  it.todo('keeps dependent content unavailable until saved preferences are restored');
  it.todo('restores durable controls and the current view');

  // Filter configuration.
  it.todo('passes one page filter contract to every data view');

  // Selection and page-spanning actions.
  it.todo('shares selected context across page views');
  it.todo('reconciles selected context after a page-owned action');

  // Modal and confirmation workflows.
  it.todo('opens page-owned dialogs from their public entry points');
  it.todo('connects confirmed actions to the owning page workflow');

  // Table, calendar, dashboard, and body initialization.
  it.todo('switches composed views without repeating child behavior');

  // Derived errors and presentation state.
  it.todo('reports page-owned failures through the shared error presentation');

  // Render.
  it.todo('composes the page header, error overlay, body, and dialogs in page order');
});
`);

  const hook = context.sourceFile(join(directory, `hooks/data/${hookName}.ts`), `
export default function ${hookName}() {
  // TODO: Group page-wide reference queries and existing domain hooks here.
  // Preserve each query's key, cancellation, loading, and error state.
  // Table and calendar collection queries stay with their view owners.
  return {};
}
`);
  const hookTest = context.sourceFile(join(directory, `hooks/data/${hookName}.test.ts`), `
import { describe, it } from 'vitest';

describe('${hookName}', () => {
  it.todo('builds page reference query keys and honors enabled conditions');
  it.todo('forwards request inputs and AbortSignal to the API adapters');
  it.todo('exposes each reference source and its loading and error state');
});
`);

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(directory, `hooks/data/${hookName}.ts`), hook],
      [join(directory, `hooks/data/${hookName}.test.ts`), hookTest],
    ]),
  };
}
