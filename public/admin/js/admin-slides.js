import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');

function authFd() {
  return { Authorization: `Bearer ${localStorage.getItem('oms_admin_token')}` };
}

if (!requireAdminSession()) {
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('slides');
  bindLogout();

  async function load() {
    const rows = await adminFetch('/api/admin/slides');
    tbody.innerHTML = rows
      .map(
        (s) => `
      <tr data-id="${s.id}">
        <td><img class="rx-thumb" src="/uploads/${esc(s.image_path)}" alt="" /></td>
        <td><input class="tl" value="${esc(s.title)}" style="width:10rem" /></td>
        <td><input class="lk" value="${esc(s.link_url || '')}" style="width:12rem" /></td>
        <td><input class="so" type="number" value="${s.sort_order}" style="width:3.5rem" /></td>
        <td><input class="en" type="checkbox" ${s.is_enabled ? 'checked' : ''} /></td>
        <td>
          <button type="button" class="btn btn-outline sv">Save</button>
          <form class="imgf" style="display:inline"><input type="file" name="image" accept="image/*" /><button type="submit" class="btn btn-outline">New img</button></form>
          <button type="button" class="btn btn-danger dl">Del</button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('tr').forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelector('.sv').onclick = async () => {
        await adminFetch(`/api/admin/slides/${id}`, {
          method: 'PATCH',
          body: {
            title: tr.querySelector('.tl').value,
            link_url: tr.querySelector('.lk').value || null,
            sort_order: Number(tr.querySelector('.so').value),
            is_enabled: tr.querySelector('.en').checked,
          },
        });
        msg.innerHTML = '<div class="alert alert-success-admin">Saved</div>';
      };
      tr.querySelector('.dl').onclick = async () => {
        if (!confirm('Delete slide?')) return;
        await adminFetch(`/api/admin/slides/${id}`, { method: 'DELETE' });
        load();
      };
      tr.querySelector('.imgf').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const r = await fetch(`/api/admin/slides/${id}/image`, { method: 'POST', headers: authFd(), body: fd });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return (msg.innerHTML = `<div class="alert alert-error">${d.error}</div>`);
        msg.innerHTML = '<div class="alert alert-success-admin">Image replaced</div>';
        load();
      };
    });
  }

  document.getElementById('add')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const r = await fetch('/api/admin/slides', { method: 'POST', headers: authFd(), body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return (msg.innerHTML = `<div class="alert alert-error">${d.error || r.statusText}</div>`);
    e.target.reset();
    load();
  });

  function esc(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  load().catch((e) => (msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`));
}
