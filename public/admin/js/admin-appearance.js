/**
 * Site settings JSON + favicon/logo multipart.
 */
import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const msg = document.getElementById('msg');
const form = document.getElementById('settings-form');

function tokenHeaders(isJson = true) {
  const h = { Authorization: `Bearer ${localStorage.getItem('oms_admin_token')}` };
  if (isJson) {
    h['Content-Type'] = 'application/json';
    h.Accept = 'application/json';
  }
  return h;
}

if (!requireAdminSession()) {
  /* redirect */
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('appearance');
  bindLogout();

  adminFetch('/api/admin/settings/raw')
    .then((raw) => {
      form.querySelectorAll('input, textarea').forEach((el) => {
        if (raw[el.name] != null) el.value = raw[el.name];
      });
      if (raw.favicon_path) {
        document.getElementById('preview-fav').innerHTML = `Favicon: <img src="/uploads/${raw.favicon_path}" alt="" height="32" />`;
      }
      if (raw.logo_path) {
        document.getElementById('preview-logo').innerHTML = `Logo: <img src="/uploads/${raw.logo_path}" alt="" height="40" />`;
      }
    })
    .catch((e) => (msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`));

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    try {
      await adminFetch('/api/admin/settings', { method: 'POST', body });
      msg.innerHTML = '<div class="alert alert-success-admin">Saved</div>';
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });

  document.getElementById('fav-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const r = await fetch('/api/admin/upload/favicon', { method: 'POST', headers: tokenHeaders(false), body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return (msg.innerHTML = `<div class="alert alert-error">${data.error || r.statusText}</div>`);
    msg.innerHTML = '<div class="alert alert-success-admin">Favicon updated</div>';
    document.getElementById('preview-fav').innerHTML = `Favicon: <img src="${data.url}" alt="" height="32" />`;
    e.target.reset();
  });

  document.getElementById('logo-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const r = await fetch('/api/admin/upload/logo', { method: 'POST', headers: tokenHeaders(false), body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return (msg.innerHTML = `<div class="alert alert-error">${data.error || r.statusText}</div>`);
    msg.innerHTML = '<div class="alert alert-success-admin">Logo updated</div>';
    document.getElementById('preview-logo').innerHTML = `Logo: <img src="${data.url}" alt="" height="40" />`;
    e.target.reset();
  });
}
