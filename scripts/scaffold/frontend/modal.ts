import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from './index.ts';

/**
 * Plans a non-trivial form modal, workflow hook, and test outlines without writing files.
 * Rejects unsupported owner paths/names through the shared context validators.
 * @param ownerPath - Repository-relative page or shared-feature directory that owns the modal.
 * @param name - PascalCase domain component name ending in Modal, such as NoteModal.
 * @returns Four formatted source files keyed by their destination paths.
 * @example modalPlan(context, 'frontend/src/common/features', 'NoteModal') // Plans NoteModal and useNoteModal with tests.
 */
export function modalPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  // 1. Validate the requested owner and derive destination names.
  const owner = context.modalOwner(ownerPath);
  const directory = context.componentOwner(owner, name, 'Modal', 'Modal');
  const modalImport = context.relativeImport(
    directory,
    join(context.frontendRoot, 'common/components/Modal/Modal'),
  );
  const hookName = `use${name}`;
  // 2. Format the component source without writing destination files.
  const component = context.sourceFile(
    join(directory, `${name}.tsx`),
    `
    import Modal from '${modalImport}';

    import ${hookName} from './hooks/${hookName}';

    interface ${name}Props {
      isOpen: boolean;
      onClose: () => void;
    }

    /**
     * Displays the ${name} form placeholder with feedback supplied by its workflow hook.
     * @example <${name} isOpen onClose={closeModal} />
     */
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
    `,
  );
  // 3. Format the companion sources and colocated test outlines.
  const hook = context.sourceFile(
    join(directory, `hooks/${hookName}.ts`),
    `
    /**
     * Supplies idle submission feedback until the ${name} workflow is implemented.
     * @example ${hookName}() // { submitStatus: 'idle', statusMessage: undefined }
     */
    export default function ${hookName}() {
      // TODO: Own initialization, draft state, validation, submission, and recovery here.
      // Represent mutually exclusive add/edit targets with a discriminated state plus null for closed.
      // Apply entry-context defaults/locks; align optional/derived fields with API validation.
      // Query only missing data while its context exists; forward inputs and cancellation.
      // Block same-tick duplicate submit and all dismissal paths while locked.
      // Return authoritative saved records; the owning page action reconciles its views.
      // Use FormField/FormFieldGroup and ModalFormFooter; inherit Modal's success delay.
      return {
        submitStatus: 'idle' as const,
        statusMessage: undefined,
      };
    }
    `,
  );
  const componentTest = context.sourceFile(
    join(directory, `${name}.test.tsx`),
    `
    // Shared Modal tests retain generic dialog, focus, Escape, dismissal, and timer behavior.
    import { describe, it } from 'vitest';

    describe('${name}', () => {
      it.todo('prevents editing context-locked values');
      it.todo('emits domain values while leaving workflow transitions to the hook');
    });
    `,
  );
  const hookTest = context.sourceFile(
    join(directory, `hooks/${hookName}.test.ts`),
    `
    import { describe, it } from 'vitest';

    describe('${hookName}', () => {
      it.todo('initializes and resets add/edit drafts with contextual locks');
      it.todo('validates and submits the exact command with same-tick locking');
      it.todo('orders authoritative success, retry, failure recovery, and cleanup');
    });
    `,
  );

  // 4. Return all sources together for conflict validation and publication.
  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), componentTest],
      [join(directory, `hooks/${hookName}.ts`), hook],
      [join(directory, `hooks/${hookName}.test.ts`), hookTest],
    ]),
  };
}
