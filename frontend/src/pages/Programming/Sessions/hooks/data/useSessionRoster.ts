import { useQuery } from '@tanstack/react-query';
import { getSessionRoster } from '../../sessions.api';

/**
 * Loads attendance from the session roster endpoint, shared by the dashboard and editor.
 * An absent session disables loading; the caller owns empty and unavailable states.
 * @example useSessionRoster('session-1') // cached roster and request state for session-1
 */
export default function useSessionRoster(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'roster'],
    queryFn: ({ signal }) => getSessionRoster(sessionId!, { signal }),
    enabled: sessionId !== undefined,
  });
}
