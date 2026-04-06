/**
 * Checkout — delivery zone, wallet UI, coupon validate, POST /api/orders.
 */
import { CartStore } from './cart-store.js';
import { formatBdt } from './api.js';
import { fetchLayout } from './layout.js';

const form = document.getElementById('checkout-form');
const msg = document.getElementById('checkout-msg');
const summary = document.getElementById('checkout-summary');
const walletPanel = document.getElementById('wallet-panel');
const walletNumber = document.getElementById('wallet-number');
const walletLabel = document.getElementById('wallet-label');
const trxInput = document.getElementById('trx');
const deliveryOpts = document.getElementById('delivery-zone-options');
const deliveryHint = document.getElementById('delivery-fee-hint');
const totalsEl = document.getElementById('totals-breakdown');
const couponMsg = document.getElementById('coupon-msg');
const btnCoupon = document.getElementById('btn-apply-coupon');

let appliedCoupon = null;

function checkoutCfg() {
  return window.__OMS_LAYOUT?.checkout || {};
}

function itemsPayload() {
  return CartStore.get().map((i) => ({ medicineId: i.id, quantity: i.qty }));
}

function renderDeliveryOptions() {
  const c = checkoutCfg();
  deliveryOpts.innerHTML = `
    <label><input type="radio" name="delivery_zone" value="inside_dhaka" checked required />
      ${escapeHtml(c.delivery_label_inside || 'Inside Dhaka')} (+${formatBdt(c.delivery_fee_inside || 0)})</label>
    <label><input type="radio" name="delivery_zone" value="outside_dhaka" />
      ${escapeHtml(c.delivery_label_outside || 'Outside Dhaka')} (+${formatBdt(c.delivery_fee_outside || 0)})</label>`;
  deliveryOpts.querySelectorAll('input[name="delivery_zone"]').forEach((el) => {
    el.addEventListener('change', () => renderTotals());
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function subtotalCart() {
  return CartStore.subtotal();
}

function deliveryFee() {
  const c = checkoutCfg();
  const z = form.querySelector('input[name="delivery_zone"]:checked')?.value;
  if (z === 'outside_dhaka') return Number(c.delivery_fee_outside) || 0;
  return Number(c.delivery_fee_inside) || 0;
}

function renderTotals() {
  const sub = subtotalCart();
  const del = deliveryFee();
  const disc = appliedCoupon?.discount_amount || 0;
  const total = Math.max(0, sub - disc + del);
  deliveryHint.textContent = `Delivery fee applies based on selected area (admin-configurable).`;
  totalsEl.innerHTML = `
    <div class="card" style="padding: 1rem">
      <p>Subtotal: <strong>${formatBdt(sub)}</strong></p>
      <p>Discount: <strong>${formatBdt(disc)}</strong></p>
      <p>Delivery: <strong>${formatBdt(del)}</strong></p>
      <p style="font-size:1.15rem">Total: <strong>${formatBdt(total)}</strong></p>
    </div>`;
}

function bindPaymentUi() {
  const sync = () => {
    const pm = form.querySelector('input[name="payment_method"]:checked')?.value;
    const wallet = pm === 'bkash' || pm === 'nagad' || pm === 'rocket';
    walletPanel.hidden = !wallet;
    trxInput.required = wallet;
    const c = checkoutCfg();
    if (pm === 'bkash') {
      walletLabel.textContent = 'bKash';
      walletNumber.textContent = c.wallet_bkash || '—';
    } else if (pm === 'nagad') {
      walletLabel.textContent = 'Nagad';
      walletNumber.textContent = c.wallet_nagad || '—';
    } else if (pm === 'rocket') {
      walletLabel.textContent = 'Rocket';
      walletNumber.textContent = c.wallet_rocket || '—';
    }
  };
  form.querySelectorAll('input[name="payment_method"]').forEach((el) => el.addEventListener('change', sync));
  sync();
}

async function renderSummary() {
  if (!summary || !form) return;
  const items = CartStore.get();
  if (!items.length) {
    summary.innerHTML = '<p>Your cart is empty. <a href="/shop">Go to shop</a></p>';
    form.style.display = 'none';
    return;
  }
  try {
    const layout = await fetchLayout();
    window.__OMS_LAYOUT = layout;
  } catch {
    /* keep cached layout if request fails */
  }
  summary.innerHTML =
    `<ul style="margin:0;padding-left:1.2rem">` +
    items.map((i) => `<li>${escapeHtml(i.name)} × ${i.qty} — ${formatBdt(i.price * i.qty)}</li>`).join('') +
    `</ul>`;
  form.style.display = '';
  renderDeliveryOptions();
  bindPaymentUi();
  renderTotals();
}

btnCoupon?.addEventListener('click', async () => {
  couponMsg.textContent = '';
  appliedCoupon = null;
  const code = document.getElementById('coupon')?.value?.trim();
  if (!code) {
    couponMsg.textContent = 'Enter a code.';
    renderTotals();
    return;
  }
  try {
    const r = await fetch('/api/public/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code, items: itemsPayload() }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText);
    appliedCoupon = data;
    couponMsg.textContent = `Applied: ${data.discount_percent}% off (৳${Number(data.discount_amount).toFixed(2)})`;
    renderTotals();
  } catch (e) {
    couponMsg.textContent = e.message;
    renderTotals();
  }
});

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.innerHTML = '';
  const items = CartStore.get();
  if (!items.length) return;

  const fd = new FormData(form);
  const payment_method = fd.get('payment_method');
  const payload = {
    items: items.map((i) => ({ medicineId: i.id, quantity: i.qty })),
    guest_phone: fd.get('guest_phone'),
    guest_name: fd.get('guest_name'),
    guest_email: fd.get('guest_email') || undefined,
    shipping_address: fd.get('shipping_address'),
    payment_method,
    delivery_zone: fd.get('delivery_zone'),
    transaction_ref: fd.get('transaction_ref') || undefined,
    coupon_code: fd.get('coupon_code')?.trim() || undefined,
    order_notes: fd.get('order_notes') || undefined,
  };

  const token = localStorage.getItem('oms_token');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || JSON.stringify(data.errors) || r.statusText);
    CartStore.clear();
    form.style.display = 'none';
    summary.innerHTML = '';
    msg.innerHTML = `
      <div class="alert alert-success">
        <p><strong>Order placed!</strong> Reference: <code>${data.order_ref}</code></p>
        <p>Total paid: ${formatBdt(data.total)} (incl. delivery ${formatBdt(data.delivery_fee)})</p>
      </div>`;
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
});

renderSummary();
window.addEventListener('oms-cart-changed', renderSummary);
