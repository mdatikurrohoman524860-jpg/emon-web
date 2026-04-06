/**
 * Admin CRUD medicines (category_id from /api/admin/categories).
 */
import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');
const addForm = document.getElementById('add-form');
const medCat = document.getElementById('med-cat');

if (!requireAdminSession()) {
  /* redirect */
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('medicines');
  bindLogout();

  async function loadCategoriesSelect() {
    const rows = await adminFetch('/api/admin/categories');
    medCat.innerHTML = rows.map((c) => `<option value="${c.id}">${escape(c.name)}</option>`).join('');
  }

  async function load() {
    const rows = await adminFetch('/api/admin/medicines');
    tbody.innerHTML = rows
      .map(
        (m) => `
      <tr data-id="${m.id}">
        <td>${m.id}</td>
        <td>${escape(m.name)}</td>
        <td>${escape(m.category_name || m.category_id)}</td>
        <td>${m.price}</td>
        <td><input type="number" class="stock-inp" value="${m.stock}" style="width:4rem" /></td>
        <td><input type="date" class="exp-inp" value="${m.expiry_date ? m.expiry_date.slice(0, 10) : ''}" /></td>
        <td>
          <button type="button" class="btn btn-outline save-btn">Save</button>
          <button type="button" class="btn btn-danger del-btn">Delete</button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('tr').forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelector('.save-btn').addEventListener('click', async () => {
        msg.innerHTML = '';
        const stock = Number(tr.querySelector('.stock-inp').value);
        const expiry_date = tr.querySelector('.exp-inp').value || null;
        try {
          await adminFetch(`/api/admin/medicines/${id}`, {
            method: 'PATCH',
            body: { stock, expiry_date },
          });
          msg.innerHTML = '<div class="alert alert-success-admin">Saved</div>';
        } catch (e) {
          msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        }
      });
      tr.querySelector('.del-btn').addEventListener('click', async () => {
        if (!confirm('Delete this medicine?')) return;
        await adminFetch(`/api/admin/medicines/${id}`, { method: 'DELETE' });
        load();
      });
    });
  }

  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    const fd = new FormData(addForm);
    const body = {
      name: fd.get('name'),
      category_id: Number(fd.get('category_id')),
      price: Number(fd.get('price')),
      stock: Number(fd.get('stock')),
      description: fd.get('description') || undefined,
      image_url: fd.get('image_url') || undefined,
      expiry_date: fd.get('expiry_date') || undefined,
    };
    try {
      await adminFetch('/api/admin/medicines', { method: 'POST', body });
      addForm.reset();
      await loadCategoriesSelect();
      load();
      msg.innerHTML = '<div class="alert alert-success-admin">Added</div>';
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });

  function escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  loadCategoriesSelect()
    .then(() => load())
    .catch((e) => {
      msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    });
}
