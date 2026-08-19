import { useCallback, useRef } from 'react';

export default function useSubmitLock() {
  const lockedRef = useRef(false);

  const tryLock = useCallback(() => {
    if (lockedRef.current) return false;
    lockedRef.current = true;
    return true;
  }, []);

  const unlock = useCallback(() => {
    lockedRef.current = false;
  }, []);

  return { tryLock, unlock };
}
