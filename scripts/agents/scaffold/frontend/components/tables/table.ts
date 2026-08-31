import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from '../../index.ts';

export function tablePlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  const owner = context.pageComponentsOwner(ownerPath, 'Table');
  const directory = context.componentOwner(owner, name, 'Table', 'Table');
  const hookName = `use${name}Data`;
  const title = name.replace(/Table$/, '');
  const component = context.sourceFile(join(directory, `${name}.tsx`), `
import ${hookName} from './hooks/${hookName}';

export default function ${name}() {
  const table = ${hookName}();

  return (
    <section aria-label="${title} table" data-loading={table.loading || undefined}>
      TODO: Connect the ${title} collection to the shared Table.
    </section>
  );
}
`);
  const hook = context.sourceFile(join(directory, `hooks/${hookName}.ts`), `
export default function ${hookName}() {
  // TODO: Own the domain query key, inputs, row shaping, and cursor adapter here.
  return {
    rows: [],
    loading: false,
  };
}
`);
  const test = context.sourceFile(join(directory, `${name}.test.tsx`), `
// Replace these placeholders with domain presentation and shared-Table boundary tests.
import { describe, it } from 'vitest';

describe('${name}', () => {
  it.todo('wires domain rows, columns, state, copy, permissions, and actions into the shared Table');
  it.todo('forwards controlled selection and emitted row selection without owning selection state');
});
`);
  const hookTest = context.sourceFile(join(directory, `hooks/${hookName}.test.ts`), `
// useInfiniteListQuery owns generic accumulation, deduplication, loading, refresh, and pagination mechanics.
import { describe, it } from 'vitest';

describe('${hookName}', () => {
  it.todo('builds the complete domain query key and honors enabled gates');
  it.todo('forwards filters, sorting, page size, cursor, and AbortSignal to the API adapter');
  it.todo('returns only domain-specific row shaping added by this hook');
});
`);

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(directory, `hooks/${hookName}.ts`), hook],
      [join(directory, `hooks/${hookName}.test.ts`), hookTest],
    ]),
  };
}
