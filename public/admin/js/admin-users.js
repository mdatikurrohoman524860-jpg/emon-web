/**
 * Customer list (read-only).
 */
import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');

if (!requireAdminSession()) {
  /* redirect */
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('users');
  bindLogout();

  adminFetch('/api/admin/users')
    .then((rows) => {
      tbody.innerHTML = rows
        .map(
          (u) => `
        <tr>
          <td>${u.id}</td>
          <td>${escape(u.name)}</td>
          <td>${escape(u.email)}</td>
          <td>${escape(u.phone || '')}</td>
          <td>${new Date(u.created_at).toLocaleString()}</td>
        </tr>`
        )
        .join('');
    })
    .catch((e) => {
      msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    });
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
