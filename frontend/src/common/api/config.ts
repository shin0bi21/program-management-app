const API_BASE = import.meta.env.VITE_API_URL;

/** Prefix a route with the API base URL */
export const api = (route: string) => `${API_BASE}${route}`;
