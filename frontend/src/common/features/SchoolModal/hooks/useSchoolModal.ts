import { useState } from 'react';

import type { SchoolAction, SchoolSelection } from '../types';

interface SchoolSession {
  action: SchoolAction;
  selection: SchoolSelection;
}

/**
 * Keeps the active school action and the selector to update after saving.
 * Draft and submission state belong to the mounted SchoolModal form.
 * @example const workflow = useSchoolModal(); workflow.open({ type: 'add' }, selection)
 */
export default function useSchoolModal() {
  const [session, setSession] = useState<SchoolSession | null>(null);

  /** Opens an action with its supplied school and selector. @example open({ type: 'edit', school }, selection) */
  const open = (action: SchoolAction, selection: SchoolSelection) => setSession({ action, selection });

  /** Closes the school interaction and unmounts its draft. @example close() */
  const close = () => setSession(null);

  return { session, action: session?.action ?? null, open, close };
}

export type SchoolModalState = ReturnType<typeof useSchoolModal>;
