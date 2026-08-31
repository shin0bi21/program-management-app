import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from '../../index.ts';

export function calendarPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  const owner = context.pageComponentsOwner(ownerPath, 'Calendar');
  const directory = context.componentOwner(owner, name, 'Calendar', 'Calendar');
  const title = name.replace(/Calendar$/, '');
  const component = context.sourceFile(join(directory, `${name}.tsx`), `
export default function ${name}() {
  return (
    <section aria-label="${title} calendar">
      TODO: Connect ${title} range data to TimelineCalendar.
    </section>
  );
}
`);
  const test = context.sourceFile(join(directory, `${name}.test.tsx`), `
// Shared TimelineCalendar tests retain generic rendering, geometry, pointer, focus, and cleanup mechanics.
import { describe, it } from 'vitest';

describe('${name}', () => {
  it.todo('wires domain range loading, rows, items, capabilities, selection, and unavailable state');
  it.todo('maps supported cell, item, move, and resize callbacks to page actions');
});
`);

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
    ]),
  };
}
