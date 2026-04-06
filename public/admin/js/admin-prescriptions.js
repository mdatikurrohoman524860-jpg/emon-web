/**
 * List prescriptions; approve / reject.
 */
import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');

if (!requireAdminSession()) {
  /* redirect */
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('prescriptions');
  bindLogout();

  async function load() {
    const rows = await adminFetch('/api/admin/prescriptions');
    tbody.innerHTML = rows
      .map(
        (p) => `
      <tr>
        <td>${p.id}</td>
        <td><a href="/uploads/${escape(p.image_path)}" target="_blank" rel="noopener"><img class="rx-thumb" src="/uploads/${escape(p.image_path)}" alt="" /></a></td>
        <td>${escape(p.guest_phone || '')}</td>
        <td>${escape(p.user_name || p.user_email || '-')}</td>
        <td>${p.verified}</td>
        <td>${new Date(p.created_at).toLocaleString()}</td>
        <td>
          <select class="vx" data-id="${p.id}">
            <option value="pending" ${p.verified === 'pending' ? 'selected' : ''}>pending</option>
            <option value="approved" ${p.verified === 'approved' ? 'selected' : ''}>approved</option>
            <option value="rejected" ${p.verified === 'rejected' ? 'selected' : ''}>rejected</option>
          </select>
          <button type="button" class="btn btn-primary sv" data-id="${p.id}">Save</button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('.sv').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const sel = tbody.querySelector(`.vx[data-id="${id}"]`);
        msg.innerHTML = '';
        try {
          await adminFetch(`/api/admin/prescriptions/${id}`, {
            method: 'PATCH',
            body: { verified: sel.value },
          });
          msg.innerHTML = '<div class="alert alert-success-admin">Updated</div>';
          load();
        } catch (e) {
          msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        }
      });
    });
  }

  function escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  load().catch((e) => {
    msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  });
}
