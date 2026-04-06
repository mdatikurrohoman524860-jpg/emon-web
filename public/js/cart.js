/**
 * Cart page — edit quantities, WhatsApp order, proceed to checkout.
 */
import { CartStore } from './cart-store.js';
import { formatBdt, getPublicConfig, whatsappOrderLink } from './api.js';

const tbody = document.querySelector('#cart-table tbody');
const empty = document.getElementById('cart-empty');
const subtotalEl = document.getElementById('cart-subtotal');
const waBtn = document.getElementById('cart-whatsapp');

function render() {
  if (!tbody) return;
  const items = CartStore.get();
  if (!items.length) {
    if (empty) empty.style.display = 'block';
    tbody.innerHTML = '';
    if (subtotalEl) subtotalEl.textContent = formatBdt(0);
    return;
  }
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = items
    .map(
      (i) => `
    <tr>
      <td><a href="/product?id=${i.id}">${escape(i.name)}</a></td>
      <td>${formatBdt(i.price)}</td>
      <td><input type="number" min="1" max="99" value="${i.qty}" data-id="${i.id}" class="qty-input" style="width:4rem" /></td>
      <td>${formatBdt(i.price * i.qty)}</td>
      <td><button type="button" class="btn btn-sm btn-outline remove-btn" data-id="${i.id}">Remove</button></td>
    </tr>`
    )
    .join('');
  if (subtotalEl) subtotalEl.textContent = formatBdt(CartStore.subtotal());

  tbody.querySelectorAll('.qty-input').forEach((inp) => {
    inp.addEventListener('change', () => {
      CartStore.setQty(inp.dataset.id, Number(inp.value));
      render();
    });
  });
  tbody.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      CartStore.remove(btn.dataset.id);
      render();
    });
  });
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

waBtn?.addEventListener('click', async () => {
  const items = CartStore.get();
  if (!items.length) return;
  const cfg = await getPublicConfig();
  const num = (cfg.whatsappNumber || '').replace(/\D/g, '');
  if (!num) {
    alert('WhatsApp number not configured.');
    return;
  }
  const sub = CartStore.subtotal();
  const text = whatsappOrderLink(items, sub);
  window.open(`https://wa.me/${num}?text=${text}`, '_blank');
});

render();
window.addEventListener('oms-cart-changed', render);
