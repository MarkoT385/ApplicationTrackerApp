export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return null;
  }
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error ?? 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return body;
}
