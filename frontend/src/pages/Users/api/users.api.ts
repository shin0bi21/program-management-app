const API_BASE = 'http://localhost:5001/api';

export async function fetchAllUsers(token: string | null) {
  const response = await fetch(`${API_BASE}/users/all`, {
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}
