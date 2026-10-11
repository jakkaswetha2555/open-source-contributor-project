// One place for all API calls: sends the session cookie and the CSRF header the server requires on writes.
const KEY = 'csrfToken';

export const getCsrfToken = () => sessionStorage.getItem(KEY);
export const setCsrfToken = (t) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const csrf = getCsrfToken();
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;

  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
