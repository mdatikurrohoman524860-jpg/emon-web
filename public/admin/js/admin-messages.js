/**
 * Contact form submissions.
 */
import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');

if (!requireAdminSession()) {
  /* redirect */
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('messages');
  bindLogout();

  adminFetch('/api/admin/contact-messages')
    .then((rows) => {
      tbody.innerHTML = rows
        .map(
          (r) => `
        <tr>
          <td>${r.id}</td>
          <td>${escape(r.name)}</td>
          <td>${escape(r.email)}</td>
          <td>${escape(r.phone || '')}</td>
          <td>${escape(r.message).slice(0, 200)}${r.message.length > 200 ? '…' : ''}</td>
          <td>${new Date(r.created_at).toLocaleString()}</td>
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
