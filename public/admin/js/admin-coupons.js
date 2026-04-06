import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const tbody = document.getElementById('tbody');
const msg = document.getElementById('msg');
const applyTo = document.getElementById('apply-to');
const cCat = document.getElementById('c-cat');
const cProd = document.getElementById('c-prod');

if (!requireAdminSession()) {
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('coupons');
  bindLogout();

  function syncApply() {
    const v = applyTo.value;
    cCat.style.display = v === 'category' ? 'block' : 'none';
    cProd.style.display = v === 'product' ? 'block' : 'none';
  }
  applyTo.addEventListener('change', syncApply);
  syncApply();

  adminFetch('/api/admin/categories').then((rows) => {
    cCat.innerHTML = rows.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  });

  async function load() {
    const rows = await adminFetch('/api/admin/coupons');
    tbody.innerHTML = rows
      .map(
        (c) => `
      <tr data-id="${c.id}">
        <td>${esc(c.code)}</td>
        <td>${c.discount_percent}</td>
        <td>${String(c.expiry_date).slice(0, 10)}</td>
        <td>${c.used_count}/${c.usage_limit || '∞'}</td>
        <td>${c.apply_to}</td>
        <td><button type="button" class="btn btn-danger dl">Del</button></td>
      </tr>`
      )
      .join('');
    tbody.querySelectorAll('.dl').forEach((b) => {
      b.onclick = async () => {
        const tr = b.closest('tr');
        if (!confirm('Delete coupon?')) return;
        await adminFetch(`/api/admin/coupons/${tr.dataset.id}`, { method: 'DELETE' });
        load();
      };
    });
  }

  document.getElementById('add')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const apply = fd.get('apply_to');
    const body = {
      code: fd.get('code'),
      discount_percent: Number(fd.get('discount_percent')),
      expiry_date: fd.get('expiry_date'),
      usage_limit: Number(fd.get('usage_limit') || 0),
      apply_to: apply,
      category_id: apply === 'category' ? Number(fd.get('category_id')) : undefined,
      product_id: apply === 'product' ? Number(fd.get('product_id')) : undefined,
      is_active: fd.get('is_active') === 'on',
    };
    try {
      await adminFetch('/api/admin/coupons', { method: 'POST', body });
      e.target.reset();
      syncApply();
      load();
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  load().catch((e) => (msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`));
}
