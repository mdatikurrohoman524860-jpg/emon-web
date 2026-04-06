/**
 * POST /api/admin/login → store oms_admin_token.
 */
const form = document.getElementById('form');
const msg = document.getElementById('msg');

if (localStorage.getItem('oms_admin_token')) {
  window.location.href = '/admin/dashboard';
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.innerHTML = '';
  const fd = new FormData(form);
  try {
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText);
    localStorage.setItem('oms_admin_token', data.token);
    window.location.href = '/admin/dashboard';
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
});
