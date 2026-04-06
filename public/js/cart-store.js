/**
 * Cart persisted in localStorage — items: { id, name, slug, price, qty, image_url }
 */
const CART_KEY = 'oms_cart_v1';

function read() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('oms-cart-changed'));
}

export const CartStore = {
  get() {
    return read();
  },
  count() {
    return read().reduce((n, i) => n + (i.qty || 0), 0);
  },
  add(item, qty = 1) {
    const items = read();
    const id = Number(item.id);
    const found = items.find((x) => x.id === id);
    if (found) {
      found.qty = Math.min(99, found.qty + qty);
    } else {
      items.push({
        id,
        name: item.name,
        slug: item.slug,
        price: Number(item.price),
        image_url: item.image_url || '',
        qty: Math.min(99, qty),
      });
    }
    write(items);
  },
  setQty(id, qty) {
    const items = read();
    const found = items.find((x) => x.id === Number(id));
    if (!found) return;
    found.qty = Math.max(1, Math.min(99, qty));
    write(items);
  },
  remove(id) {
    write(read().filter((x) => x.id !== Number(id)));
  },
  clear() {
    write([]);
  },
  subtotal() {
    return read().reduce((s, i) => s + Number(i.price) * i.qty, 0);
  },
};
