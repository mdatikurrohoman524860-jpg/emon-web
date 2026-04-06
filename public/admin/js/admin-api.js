/**
 * Authenticated admin fetch — uses oms_admin_token from localStorage.
 */
export async function adminFetch(path, opts = {}) {
  const token = localStorage.getItem('oms_admin_token');
  const headers = { Accept: 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = opts.body;
  if (body !== undefined && body !== null && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const r = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: body === undefined ? undefined : body,
  });

  const data = await r.json().catch(() => ({}));
  if (r.status === 401) {
    localStorage.removeItem('oms_admin_token');
    if (!String(path).includes('login')) window.location.href = '/admin/login';
  }
  if (!r.ok) throw new Error(data.error || JSON.stringify(data.errors) || r.statusText);
  return data;
}

export function requireAdminSession() {
  if (!localStorage.getItem('oms_admin_token')) {
    window.location.href = '/admin/login';
    return false;
  }
  return true;
}
