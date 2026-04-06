import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const msg = document.getElementById('msg');
const tables = document.getElementById('tables');
const secSel = document.getElementById('sec-sel');

if (!requireAdminSession()) {
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('footer');
  bindLogout();

  async function load() {
    const { sections, links } = await adminFetch('/api/admin/footer');
    secSel.innerHTML = sections.map((s) => `<option value="${s.id}">${s.title}</option>`).join('');

    tables.innerHTML = sections
      .map((s) => {
        const ls = links.filter((l) => l.section_id === s.id);
        return `<h3>${esc(s.title)} <button type="button" class="btn btn-danger btn-sm rm-sec" data-id="${s.id}">Remove section</button></h3>
        <div class="table-wrap"><table><thead><tr><th>Label</th><th>URL</th><th>Icon</th><th></th></tr></thead><tbody>
        ${ls
          .map(
            (l) => `<tr data-lid="${l.id}">
          <td><input class="lb" value="${esc(l.label)}" /></td>
          <td><input class="ur" value="${esc(l.url)}" style="width:14rem" /></td>
          <td><input class="ic" value="${esc(l.icon || '')}" style="width:4rem" /></td>
          <td><button type="button" class="btn btn-outline svl">Save</button>
          <button type="button" class="btn btn-danger dll">Del</button></td>
        </tr>`
          )
          .join('')}
        </tbody></table></div>`;
      })
      .join('');

    tables.querySelectorAll('.rm-sec').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Delete section and its links?')) return;
        await adminFetch(`/api/admin/footer/sections/${b.dataset.id}`, { method: 'DELETE' });
        load();
      };
    });
    tables.querySelectorAll('.svl').forEach((b) => {
      b.onclick = async () => {
        const tr = b.closest('tr');
        const id = tr.dataset.lid;
        await adminFetch(`/api/admin/footer/links/${id}`, {
          method: 'PATCH',
          body: {
            label: tr.querySelector('.lb').value,
            url: tr.querySelector('.ur').value,
            icon: tr.querySelector('.ic').value,
          },
        });
        msg.innerHTML = '<div class="alert alert-success-admin">Saved link</div>';
      };
    });
    tables.querySelectorAll('.dll').forEach((b) => {
      b.onclick = async () => {
        const tr = b.closest('tr');
        await adminFetch(`/api/admin/footer/links/${tr.dataset.lid}`, { method: 'DELETE' });
        load();
      };
    });
  }

  document.getElementById('add-sec')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await adminFetch('/api/admin/footer/sections', {
      method: 'POST',
      body: { title: fd.get('title'), sort_order: Number(fd.get('sort_order') || 0) },
    });
    e.target.reset();
    load();
  });

  document.getElementById('add-link')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await adminFetch('/api/admin/footer/links', {
      method: 'POST',
      body: {
        section_id: Number(fd.get('section_id')),
        label: fd.get('label'),
        url: fd.get('url'),
        icon: fd.get('icon') || null,
        sort_order: Number(fd.get('sort_order') || 0),
      },
    });
    e.target.reset();
    load();
  });

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  load().catch((e) => (msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`));
}
