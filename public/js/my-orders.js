/**
 * Customer order list — GET /api/orders/mine (JWT). Refreshes periodically.
 */
import { apiGet, formatBdt } from './api.js';

const listEl = document.getElementById('my-orders-list');
const msgEl = document.getElementById('my-orders-msg');

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function statusLabel(status) {
  const map = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return map[status] || escape(status);
}

function pillClass(status) {
  const k = String(status || '').toLowerCase();
  if (['pending', 'processing', 'delivered', 'cancelled', 'shipped'].includes(k)) return `pill-${k}`;
  return 'pill-pending';
}

async function load() {
  const token = localStorage.getItem('oms_token');
  if (!token) {
    msgEl.innerHTML = `<div class="alert alert-error">Please <a href="/login">log in</a> to see your orders.</div>`;
    listEl.innerHTML = '';
    return;
  }
  try {
    const data = await apiGet('/api/orders/mine', { auth: true });
    const rows = data.orders || [];
    if (!rows.length) {
      listEl.innerHTML = '<p class="field-hint">No orders on this account yet.</p>';
      msgEl.innerHTML = '';
      return;
    }
    msgEl.innerHTML = '';
    listEl.innerHTML = rows
      .map(
        (o) => `
      <article class="card order-card-my" style="padding:1rem 1.1rem;margin-bottom:1rem">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:0.5rem;align-items:center">
          <strong>${escape(o.order_ref)}</strong>
          <span class="pill ${pillClass(o.status)}">${statusLabel(o.status)}</span>
        </div>
        <p class="field-hint" style="margin:0.35rem 0">${new Date(o.created_at).toLocaleString()}</p>
        <p style="margin:0.25rem 0"><strong>Total:</strong> ${formatBdt(o.total)} · ${escape(o.payment_method || '')}</p>
        <p style="margin:0;font-size:0.9rem">${escape((o.shipping_address || '').slice(0, 120))}${(o.shipping_address || '').length > 120 ? '…' : ''}</p>
        <p style="margin-top:0.75rem;margin-bottom:0">
          <a class="btn btn-outline btn-sm" href="/track">Track with phone</a>
        </p>
      </article>`
      )
      .join('');
  } catch (e) {
    msgEl.innerHTML = `<div class="alert alert-error">${escape(e.message)}</div>`;
    listEl.innerHTML = '';
  }
}

load();
setInterval(load, 25000);
