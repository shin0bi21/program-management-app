import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

export function dashboardPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  const owner = context.pageComponentsOwner(ownerPath, 'Dashboard');
  const directory = context.componentOwner(owner, name, 'Dashboard', 'Dashboard');
  const title = name.replace(/Dashboard$/, '');
  const component = context.sourceFile(join(directory, `${name}.tsx`), `
export default function ${name}() {
  // Cards own private queries; receive shared page data through props.
  // Add a dashboard data hook only for queries shared by sibling cards.
  return (
    <>
      TODO: Compose the ${title} dashboard cards.
    </>
  );
}
`);
  const test = context.sourceFile(join(directory, `${name}.test.tsx`), `
// Cards own private queries and actions; test only coordination added by the dashboard.
import { describe, it } from 'vitest';

describe('${name}', () => {
  it.todo('routes a card action to the currently selected record');
});
`);

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
    ]),
  };
}
