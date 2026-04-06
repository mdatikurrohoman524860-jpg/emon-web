/**
 * Low stock and near-expiry lists.
 */
import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const low = document.getElementById('low');
const exp = document.getElementById('exp');

if (!requireAdminSession()) {
  /* redirect */
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('stock');
  bindLogout();

  adminFetch('/api/admin/stock').then((d) => {
    low.innerHTML = d.low_stock
      .map(
        (m) => `
      <tr>
        <td>${m.id}</td>
        <td>${escape(m.name)}</td>
        <td>${m.stock}</td>
        <td>${m.expiry_date || '-'}</td>
      </tr>`
      )
      .join('') || '<tr><td colspan="4">None</td></tr>';

    exp.innerHTML = d.expiring_soon
      .map(
        (m) => `
      <tr>
        <td>${m.id}</td>
        <td>${escape(m.name)}</td>
        <td>${m.stock}</td>
        <td>${m.expiry_date || '-'}</td>
      </tr>`
      )
      .join('') || '<tr><td colspan="4">None</td></tr>';
  });
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
