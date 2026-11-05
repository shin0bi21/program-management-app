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
  const pageMessageOverlayImport = context.relativeImport(
    directory,
    join(context.frontendRoot, 'common/components/PageMessageOverlay/PageMessageOverlay'),
  );
  const component = context.sourceFile(join(directory, `${name}.tsx`), `
import PageBody from '${pageBodyImport}';
import PageMessageOverlay from '${pageMessageOverlayImport}';
import PageHeader from '${pageHeaderImport}';
import ${hookName} from './hooks/data/${hookName}';

export default function ${name}() {
  // TODO: Page-local message state.

  // TODO: Permissions and application services.

  // Page data.
  ${hookName}();
  // TODO: Pass loaded options to preferences and page children.

  // TODO: Saved preferences, when this page has durable controls.
  // Use a page hook backed by usePreferences; follow docs/frontend/pages/preferences.md.
  // Return grouped search, filters, and table controls, with ready/error at the top level.
  // Gate every preference-backed control, including search, on ready before allowing edits.
  // Keep view/setView at the top level when multiple views are supported.

  // TODO: Filter configuration passed to every page data view.

  // TODO: Selection and page-spanning actions.

  // TODO: Modal and confirmation workflows.

  // TODO: Table, calendar, dashboard, and body initialization.
  const dashboard = <p>${name} dashboard</p>;
  const primaryView = <p>${name} content</p>;

  // TODO: Derived messages and presentation state.
  const pageMessages = [];

  // Render.
  return (
    <main className="page-container">
      <PageHeader title="${name}" />
      <PageMessageOverlay messages={pageMessages} />
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

// Page tests own applied inputs, permissions, selection, and dialog coordination.
// Child table, query, and pure policy suites own their internal behavior.
describe('${name}', () => {
  // Entry and readiness.
  it.todo('shows only the page actions allowed by the current permissions');
  it.todo('shows the page loading state while required data loads');
  it.todo('keeps preference-backed search and filters unavailable until saved preferences are restored');

  // Rendered states.
  it.todo('reports page-owned failures through the shared message overlay');

  // Controls and views.
  it.todo('applies search and filters to each active data view');
  it.todo('connects restored controls and view changes to the active content');

  // Selection and coordination.
  it.todo('shares selected context across page views');
  it.todo('reconciles selected context after a page-owned action');

  // Commands and dialogs.
  it.todo('opens page-owned dialogs from their public entry points');
  it.todo('connects confirmed actions to the owning page workflow');
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
