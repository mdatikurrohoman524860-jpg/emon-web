/**
 * API helpers — same-origin /api.
 */
export async function apiGet(path, { auth = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (auth) {
    const token = localStorage.getItem('oms_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const r = await fetch(path, { headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}

export async function apiPost(path, body, isForm = false) {
  const headers = { Accept: 'application/json' };
  if (!isForm) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem('oms_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = {
    method: 'POST',
    headers,
    body: isForm ? body : JSON.stringify(body),
  };
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || JSON.stringify(data.errors) || r.statusText);
  return data;
}

export function formatBdt(n) {
  return `৳ ${Number(n).toFixed(2)}`;
}

/** Uses layout checkout block (no long-lived cache — call after layout if possible). */
export async function getPublicConfig() {
  try {
    const r = await fetch('/api/public/layout');
    const layout = await r.json();
    return {
      siteName: layout.settings?.brand_name,
      whatsappNumber: layout.checkout?.whatsappNumber || '',
      currency: 'BDT',
      checkout: layout.checkout,
    };
  } catch {
    const r = await fetch('/api/config');
    return r.json();
  }
}

export function whatsappOrderLink(items, subtotal) {
  const lines = items.map((i) => `${i.name} x${i.qty} — ৳${(i.price * i.qty).toFixed(2)}`);
  const text = `Hello, I want to order from Online Medicine Store:%0A%0A${lines.join('%0A')}%0A%0ATotal: ৳${subtotal.toFixed(2)}`;
  return text;
}
