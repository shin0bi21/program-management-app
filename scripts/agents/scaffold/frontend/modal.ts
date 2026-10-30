import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

export function modalPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  const owner = context.modalOwner(ownerPath);
  const directory = context.componentOwner(owner, name, 'Modal', 'Modal');
  const modalImport = context.relativeImport(
    directory,
    join(context.frontendRoot, 'common/components/Modal/Modal'),
  );
  const hookName = `use${name}`;
  const component = context.sourceFile(join(directory, `${name}.tsx`), `
import Modal from '${modalImport}';

import ${hookName} from './hooks/${hookName}';

interface ${name}Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ${name}({ isOpen, onClose }: ${name}Props) {
  const workflow = ${hookName}();

  return (
    <Modal
      isOpen={isOpen}
      title="${name.replace(/Modal$/, '')}"
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      onClose={onClose}
    >
      <p>TODO: Add the ${name} form workflow.</p>
    </Modal>
  );
}
`);
  const hook = context.sourceFile(join(directory, `hooks/${hookName}.ts`), `
export default function ${hookName}() {
  // TODO: Own initialization, draft state, validation, submission, and recovery here.
  return {
    submitStatus: 'idle' as const,
    statusMessage: undefined,
  };
}
`);
  const componentTest = context.sourceFile(join(directory, `${name}.test.tsx`), `
// Shared Modal tests retain generic dialog, focus, Escape, dismissal, and timer behavior.
import { describe, it } from 'vitest';

describe('${name}', () => {
  it.todo('prevents editing context-locked values');
  it.todo('emits domain values while leaving workflow transitions to the hook');
});
`);
  const hookTest = context.sourceFile(join(directory, `hooks/${hookName}.test.ts`), `
import { describe, it } from 'vitest';

describe('${hookName}', () => {
  it.todo('initializes and resets add/edit drafts with contextual locks');
  it.todo('validates and submits the exact command with same-tick locking');
  it.todo('orders authoritative success, retry, failure recovery, and cleanup');
});
`);

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), componentTest],
      [join(directory, `hooks/${hookName}.ts`), hook],
      [join(directory, `hooks/${hookName}.test.ts`), hookTest],
    ]),
  };
}
