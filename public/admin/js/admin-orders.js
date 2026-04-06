/**
 * Orders: searchable list, status includes shipped, detail with fees/coupon.
 */
import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

const tbody = document.getElementById('tbody');
const detail = document.getElementById('detail');
const msg = document.getElementById('msg');
const fStatus = document.getElementById('f-status');
const fPay = document.getElementById('f-pay');
const searchQ = document.getElementById('search-q');

if (!requireAdminSession()) {
  /* redirect */
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('orders');
  bindLogout();

  async function load() {
    const params = new URLSearchParams();
    const q = searchQ?.value?.trim();
    if (q) params.set('q', q);
    if (fStatus.value) params.set('status', fStatus.value);
    if (fPay.value) params.set('payment_method', fPay.value);
    const qs = params.toString();
    const rows = await adminFetch(`/api/admin/orders-search${qs ? `?${qs}` : ''}`);
    tbody.innerHTML = rows
      .map(
        (o) => `
      <tr>
        <td><button type="button" class="btn btn-outline ref-btn" data-id="${o.id}">${escape(o.order_ref)}</button></td>
        <td>${escape(o.guest_name || '')}</td>
        <td>${escape(o.guest_phone)}</td>
        <td>${o.total}</td>
        <td>${o.payment_method}</td>
        <td>
          <select class="st-sel" data-id="${o.id}">
            ${['pending', 'processing', 'shipped', 'delivered', 'cancelled']
              .map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`)
              .join('')}
          </select>
        </td>
        <td>${new Date(o.created_at).toLocaleString()}</td>
        <td><button type="button" class="btn btn-primary save-st" data-id="${o.id}">Update</button></td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('.save-st').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const sel = tbody.querySelector(`.st-sel[data-id="${id}"]`);
        msg.innerHTML = '';
        try {
          await adminFetch(`/api/admin/orders/${id}/status`, {
            method: 'PATCH',
            body: { status: sel.value },
          });
          msg.innerHTML = '<div class="alert alert-success-admin">Updated (customer notified if email + SMTP configured)</div>';
        } catch (e) {
          msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        }
      });
    });

    tbody.querySelectorAll('.ref-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const data = await adminFetch(`/api/admin/orders/${btn.dataset.id}`);
        const o = data.order;
        const hist = (data.history || [])
          .map(
            (h) =>
              `<li style="margin-bottom:0.5rem"><small class="field-hint">${new Date(h.created_at).toLocaleString()}</small><br/>${escape(h.detail || h.event_type || '')}</li>`
          )
          .join('');
        detail.innerHTML = `
          <h2>Order ${escape(o.order_ref)}</h2>
          <p><strong>${escape(o.guest_name || '')}</strong> · ${escape(o.guest_phone)} ${o.guest_email ? `· ${escape(o.guest_email)}` : ''}</p>
          <p>Subtotal ${o.subtotal} · Delivery ${o.delivery_fee} · Discount ${o.discount_amount} · <strong>Total ${o.total}</strong></p>
          <p>Zone: ${escape(o.delivery_zone)} · Pay: ${o.payment_method} ${o.transaction_ref ? `· Txn ${escape(o.transaction_ref)}` : ''}</p>
          ${o.coupon_code ? `<p>Coupon: ${escape(o.coupon_code)}</p>` : ''}
          ${o.order_notes ? `<p>Notes: ${escape(o.order_notes)}</p>` : ''}
          <p>${escape(o.shipping_address)}</p>
          <ul>${data.items.map((i) => `<li>${escape(i.medicine_name)} × ${i.quantity} @ ${i.unit_price}</li>`).join('')}</ul>
          <h3 style="margin-top:1rem">Status history</h3>
          ${hist ? `<ul style="padding-left:1.2rem;margin:0">${hist}</ul>` : '<p class="field-hint">No events logged yet.</p>'}`;
      });
    });
  }

  function escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  document.getElementById('btn-search')?.addEventListener('click', () =>
    load().catch((e) => (msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`))
  );
  fStatus.addEventListener('change', () => load().catch((e) => (msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`)));
  fPay.addEventListener('change', () => load().catch((e) => (msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`)));

  load().catch((e) => {
    msg.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  });
}
