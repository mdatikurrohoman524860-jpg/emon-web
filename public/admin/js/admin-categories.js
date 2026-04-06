import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');

if (!requireAdminSession()) {
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('categories');
  bindLogout();

  async function load() {
    const rows = await adminFetch('/api/admin/categories');
    tbody.innerHTML = rows
      .map(
        (c) => `
      <tr data-id="${c.id}">
        <td><input class="nm" value="${esc(c.name)}" /></td>
        <td>${esc(c.slug)}</td>
        <td><input class="so" type="number" value="${c.sort_order}" style="width:4rem" /></td>
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
        await adminFetch(`/api/admin/categories/${id}`, {
          method: 'PATCH',
          body: { name: tr.querySelector('.nm').value, sort_order: Number(tr.querySelector('.so').value) },
        });
        msg.innerHTML = '<div class="alert alert-success-admin">Saved</div>';
        load();
      };
      tr.querySelector('.dl').onclick = async () => {
        if (!confirm('Delete?')) return;
        try {
          await adminFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
          load();
        } catch (e) {
          msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        }
      };
    });
  }

  document.getElementById('add')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await adminFetch('/api/admin/categories', {
      method: 'POST',
      body: {
        name: fd.get('name'),
        description: fd.get('description') || '',
        sort_order: Number(fd.get('sort_order') || 0),
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
