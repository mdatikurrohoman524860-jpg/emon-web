/**
 * Order tracking — GET /api/orders/track + status history.
 */
import { apiGet, formatBdt } from './api.js';

const form = document.getElementById('track-form');
const out = document.getElementById('track-result');

let pollTimer = null;

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function statusPill(status) {
  const k = String(status || '').toLowerCase();
  const cls = ['pending', 'processing', 'delivered', 'cancelled', 'shipped'].includes(k) ? `pill-${k}` : 'pill-pending';
  const label =
    {
      pending: 'Pending',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    }[k] || escape(status);
  return `<span class="pill ${cls}">${label}</span>`;
}

function historyBlock(history) {
  const rows = (history || []).map(
    (h) => `
    <li class="order-history-item">
      <span class="order-history-dot" aria-hidden="true"></span>
      <div>
        <p class="order-history-detail">${escape(h.detail || h.event_type || '')}</p>
        <small class="field-hint">${new Date(h.created_at).toLocaleString()}</small>
      </div>
    </li>`
  );
  return `
    <h3 class="order-history-title">Order history</h3>
    <ol class="order-history">${rows.join('')}</ol>`;
}

async function fetchAndRender(ref, phone) {
  const data = await apiGet(`/api/orders/track?ref=${encodeURIComponent(ref)}&phone=${encodeURIComponent(phone)}`);
  const o = data.order;
  out.innerHTML = `
      <div class="card track-result-card" style="padding:1rem;margin-top:1rem">
        <p><strong>Reference:</strong> ${escape(o.order_ref)} ${statusPill(o.status)}</p>
        <p><strong>Subtotal:</strong> ${formatBdt(o.subtotal ?? 0)} · <strong>Delivery:</strong> ${formatBdt(o.delivery_fee ?? 0)} · <strong>Discount:</strong> ${formatBdt(o.discount_amount ?? 0)}</p>
        <p><strong>Total:</strong> ${formatBdt(o.total)}</p>
        <p><strong>Payment:</strong> ${escape(o.payment_method)}${o.transaction_ref ? ` · <strong>Txn:</strong> ${escape(o.transaction_ref)}` : ''}</p>
        ${o.coupon_code ? `<p><strong>Coupon:</strong> ${escape(o.coupon_code)}</p>` : ''}
        <p><strong>Delivery zone:</strong> ${escape(o.delivery_zone || '')}</p>
        <p><strong>Placed:</strong> ${new Date(o.created_at).toLocaleString()}</p>
        <p><strong>Address:</strong> ${escape(o.shipping_address)}</p>
        <h3 style="margin-top:1rem">Items</h3>
        <ul>
          ${data.items.map((i) => `<li>${escape(i.name)} × ${i.quantity} @ ${formatBdt(i.unit_price)}</li>`).join('')}
        </ul>
        ${historyBlock(data.history)}
      </div>`;
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  out.innerHTML = '<p class="field-hint">Loading…</p>';
  const fd = new FormData(form);
  const ref = fd.get('ref');
  const phone = fd.get('phone');
  try {
    await fetchAndRender(ref, phone);
    pollTimer = setInterval(async () => {
      try {
        await fetchAndRender(ref, phone);
      } catch {
        /* keep last good render */
      }
    }, 30000);
  } catch (err) {
    out.innerHTML = `<div class="alert alert-error">${escape(err.message)}</div>`;
  }
});
