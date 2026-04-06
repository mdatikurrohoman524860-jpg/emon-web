/**
 * Coupon validation against cart lines (medicine ids + quantities).
 */
import { query, getPool } from '../config/database.js';

export async function validateCouponForCart(code, items) {
  const pool = getPool();
  const norm = String(code).trim().toUpperCase();
  const rows = await query(`SELECT * FROM coupons WHERE UPPER(code) = ? AND is_active = 1`, [norm]);
  if (!rows.length) {
    return { ok: false, error: 'Invalid coupon code' };
  }
  const c = rows[0];
  const today = new Date().toISOString().slice(0, 10);
  if (String(c.expiry_date) < today) {
    return { ok: false, error: 'Coupon has expired' };
  }
  if (c.usage_limit > 0 && c.used_count >= c.usage_limit) {
    return { ok: false, error: 'Coupon usage limit reached' };
  }

  const medicineIds = [...new Set(items.map((i) => Number(i.medicineId)))];
  const placeholders = medicineIds.map(() => '?').join(',');
  const [medRows] = await pool.query(
    `SELECT m.id, m.price, m.category_id FROM medicines m WHERE m.id IN (${placeholders})`,
    medicineIds
  );
  const medMap = Object.fromEntries(medRows.map((m) => [m.id, m]));

  let subtotal = 0;
  const applicableSubtotal = { amount: 0, hasMatch: false };

  for (const line of items) {
    const m = medMap[line.medicineId];
    if (!m) {
      return { ok: false, error: 'Invalid product in cart' };
    }
    const lineTotal = Number(m.price) * Number(line.quantity);
    subtotal += lineTotal;

    if (c.apply_to === 'all') {
      applicableSubtotal.amount += lineTotal;
      applicableSubtotal.hasMatch = true;
    } else if (c.apply_to === 'category' && c.category_id && m.category_id === c.category_id) {
      applicableSubtotal.amount += lineTotal;
      applicableSubtotal.hasMatch = true;
    } else if (c.apply_to === 'product' && c.product_id && m.id === c.product_id) {
      applicableSubtotal.amount += lineTotal;
      applicableSubtotal.hasMatch = true;
    }
  }

  if (!applicableSubtotal.hasMatch) {
    return { ok: false, error: 'Coupon does not apply to items in your cart' };
  }

  const pct = Number(c.discount_percent);
  const discount_amount = Math.min(
    applicableSubtotal.amount,
    Math.round((applicableSubtotal.amount * pct) / 100 * 100) / 100
  );

  return {
    ok: true,
    coupon_id: c.id,
    code: c.code,
    discount_percent: pct,
    discount_amount,
    subtotal,
  };
}
