/** Fixed values stored by program_sessions.session_type and accepted by session APIs. */
export const SESSION_TYPES = ['Regular', 'Guest Speaker', 'Field Trip'] as const;

export type SessionType = typeof SESSION_TYPES[number];
