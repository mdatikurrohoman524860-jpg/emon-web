import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');

if (!requireAdminSession()) {
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('navigation');
  bindLogout();

  async function load() {
    const rows = await adminFetch('/api/admin/nav');
    tbody.innerHTML = rows
      .map(
        (n) => `
      <tr data-id="${n.id}">
        <td><input class="lbl" value="${esc(n.label)}" style="width:7rem" /></td>
        <td><input class="url" value="${esc(n.url_path)}" style="width:12rem" /></td>
        <td><input class="ord" type="number" value="${n.sort_order}" style="width:4rem" /></td>
        <td><input class="act" type="checkbox" ${n.is_active ? 'checked' : ''} /></td>
        <td>
          <button type="button" class="btn btn-outline sv">Save</button>
          <button type="button" class="btn btn-danger dl">Del</button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('tr').forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelector('.sv').onclick = async () => {
        msg.innerHTML = '';
        try {
          await adminFetch(`/api/admin/nav/${id}`, {
            method: 'PATCH',
            body: {
              label: tr.querySelector('.lbl').value,
              url_path: tr.querySelector('.url').value,
              sort_order: Number(tr.querySelector('.ord').value),
              is_active: tr.querySelector('.act').checked,
            },
          });
          msg.innerHTML = '<div class="alert alert-success-admin">Saved</div>';
        } catch (e) {
          msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        }
      };
      tr.querySelector('.dl').onclick = async () => {
        if (!confirm('Delete?')) return;
        await adminFetch(`/api/admin/nav/${id}`, { method: 'DELETE' });
        load();
      };
    });
  }

  document.getElementById('add')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await adminFetch('/api/admin/nav', {
      method: 'POST',
      body: {
        label: fd.get('label'),
        url_path: fd.get('url_path'),
        sort_order: Number(fd.get('sort_order') || 0),
        is_active: e.target.querySelector('input[name=is_active]')?.checked !== false,
      },
    });
    e.target.reset();
    load();
  });

  function esc(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  load().catch((e) => (msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`));
}
