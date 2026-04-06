/**
 * Checkout: create order with delivery zone, wallet ref, coupon; track by ref + phone.
 */
import { Router } from 'express';
import { body, query as qv, validationResult } from 'express-validator';
import { getPool, query } from '../config/database.js';
import { generateOrderRef } from '../utils/helpers.js';
import { optionalCustomerAuth } from '../middleware/customerAuth.js';
import { requireCustomerAuth } from '../middleware/requireCustomer.js';
import { getSettingsMap } from '../services/site.service.js';
import { validateCouponForCart } from '../services/coupon.service.js';
import { isMissingTableError, sendDbError } from '../utils/dbErrors.js';

const router = Router();

const PAYMENT_METHODS = ['cod', 'bkash', 'nagad', 'rocket'];
const DELIVERY_ZONES = ['inside_dhaka', 'outside_dhaka'];

router.post(
  '/',
  optionalCustomerAuth,
  body('items').isArray({ min: 1 }),
  body('items.*.medicineId').isInt({ min: 1 }),
  body('items.*.quantity').isInt({ min: 1, max: 99 }),
  body('guest_phone').trim().notEmpty(),
  body('guest_name').trim().notEmpty(),
  body('guest_email').optional().trim().isEmail(),
  body('shipping_address').trim().isLength({ min: 10, max: 2000 }),
  body('payment_method').isIn(PAYMENT_METHODS),
  body('delivery_zone').isIn(DELIVERY_ZONES),
  body('transaction_ref').optional().trim().isLength({ max: 120 }),
  body('coupon_code').optional().trim().isLength({ max: 64 }),
  body('order_notes').optional().trim().isLength({ max: 2000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      items,
      guest_phone,
      guest_name,
      guest_email,
      shipping_address,
      payment_method,
      delivery_zone,
      transaction_ref,
      coupon_code,
      order_notes,
    } = req.body;

    if (['bkash', 'nagad', 'rocket'].includes(payment_method)) {
      const tr = transaction_ref?.trim();
      if (!tr) {
        return res.status(400).json({ error: 'Transaction ID / Reference is required for selected wallet payment' });
      }
    }

    const userId = req.user?.id ?? null;
    const settings = await getSettingsMap();
    const feeInside = Number(settings.delivery_fee_inside) || 0;
    const feeOutside = Number(settings.delivery_fee_outside) || 0;
    const delivery_fee = delivery_zone === 'inside_dhaka' ? feeInside : feeOutside;

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const medicineIds = [...new Set(items.map((i) => i.medicineId))];
      const placeholders = medicineIds.map(() => '?').join(',');
      const [medRows] = await conn.query(
        `SELECT id, price, stock, name FROM medicines WHERE id IN (${placeholders})`,
        medicineIds
      );
      const medMap = Object.fromEntries(medRows.map((m) => [m.id, m]));

      let subtotal = 0;
      const lineItems = [];
      for (const line of items) {
        const m = medMap[line.medicineId];
        if (!m) {
          await conn.rollback();
          return res.status(400).json({ error: `Invalid medicine id: ${line.medicineId}` });
        }
        if (m.stock < line.quantity) {
          await conn.rollback();
          return res.status(400).json({ error: `Insufficient stock for ${m.name}` });
        }
        const lineTotal = Number(m.price) * line.quantity;
        subtotal += lineTotal;
        lineItems.push({
          medicine_id: m.id,
          quantity: line.quantity,
          unit_price: m.price,
        });
      }

      let discount_amount = 0;
      let couponId = null;
      let couponCodeStored = null;
      if (coupon_code && String(coupon_code).trim()) {
        const v = await validateCouponForCart(coupon_code, items);
        if (!v.ok) {
          await conn.rollback();
          return res.status(400).json({ error: v.error });
        }
        const [cRows] = await conn.query('SELECT * FROM coupons WHERE id = ? FOR UPDATE', [v.coupon_id]);
        if (!cRows.length) {
          await conn.rollback();
          return res.status(400).json({ error: 'Coupon not found' });
        }
        const cRow = cRows[0];
        if (cRow.usage_limit > 0 && cRow.used_count >= cRow.usage_limit) {
          await conn.rollback();
          return res.status(400).json({ error: 'Coupon usage limit reached' });
        }
        discount_amount = v.discount_amount;
        couponId = v.coupon_id;
        couponCodeStored = cRow.code;
      }

      const total = Math.max(0, subtotal - discount_amount + delivery_fee);

      let orderRef = generateOrderRef();
      for (let attempt = 0; attempt < 5; attempt++) {
        const [dup] = await conn.query('SELECT id FROM orders WHERE order_ref = ?', [orderRef]);
        if (!dup.length) break;
        orderRef = generateOrderRef();
      }

      const walletRef =
        ['bkash', 'nagad', 'rocket'].includes(payment_method) && transaction_ref ? transaction_ref.trim() : null;

      const [orderResult] = await conn.query(
        `INSERT INTO orders (
          order_ref, user_id, guest_name, guest_email, guest_phone, shipping_address,
          payment_method, status, subtotal, delivery_fee, discount_amount, total,
          delivery_zone, transaction_ref, order_notes, coupon_id, coupon_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderRef,
          userId,
          guest_name,
          guest_email || null,
          guest_phone,
          shipping_address,
          payment_method,
          subtotal,
          delivery_fee,
          discount_amount,
          total,
          delivery_zone,
          walletRef,
          order_notes || null,
          couponId,
          couponCodeStored,
        ]
      );
      const orderId = orderResult.insertId;

      for (const li of lineItems) {
        await conn.query(
          'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
          [orderId, li.medicine_id, li.quantity, li.unit_price]
        );
        await conn.query('UPDATE medicines SET stock = stock - ? WHERE id = ?', [li.quantity, li.medicine_id]);
      }

      if (couponId) {
        await conn.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [couponId]);
        await conn.query('INSERT INTO coupon_redemptions (coupon_id, order_id) VALUES (?, ?)', [couponId, orderId]);
      }

      await conn.query(
        `INSERT INTO order_events (order_id, event_type, detail) VALUES (?, 'placed', ?)`,
        [orderId, `Order ${orderRef} placed — Pending`]
      );

      await conn.commit();
      res.status(201).json({
        order_ref: orderRef,
        id: orderId,
        subtotal,
        delivery_fee,
        discount_amount,
        total,
        message: 'Order placed successfully',
      });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {
        /* ignore rollback errors */
      }
      if (isMissingTableError(e)) {
        return res.status(503).json({
          error:
            'Database tables are missing. Stop the server, then run: npm run db:setup — then start again.',
        });
      }
      console.error(e);
      return res.status(500).json({ error: 'Could not place order' });
    } finally {
      conn.release();
    }
  }
);

router.get('/mine', requireCustomerAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, order_ref, status, total, subtotal, delivery_fee, discount_amount, payment_method,
              created_at, guest_phone, shipping_address
       FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ orders: rows });
  } catch (err) {
    return sendDbError(res, err);
  }
});

router.get(
  '/track',
  qv('ref').trim().notEmpty(),
  qv('phone').trim().notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { ref, phone } = req.query;
      const orders = await query(
        `SELECT o.id, o.order_ref, o.status, o.subtotal, o.delivery_fee, o.discount_amount, o.total,
                o.payment_method, o.created_at, o.shipping_address, o.transaction_ref, o.delivery_zone, o.coupon_code,
                o.guest_name
         FROM orders o WHERE o.order_ref = ? AND o.guest_phone = ?`,
        [ref, phone]
      );
      if (!orders.length) {
        return res.status(404).json({ error: 'No order found for this reference and phone' });
      }
      const o = orders[0];
      const items = await query(
        `SELECT oi.quantity, oi.unit_price, m.name, m.slug
         FROM order_items oi JOIN medicines m ON m.id = oi.medicine_id WHERE oi.order_id = ?`,
        [o.id]
      );
      let history = await query(
        `SELECT event_type, detail, created_at FROM order_events WHERE order_id = ? ORDER BY created_at ASC`,
        [o.id]
      );
      if (!history.length) {
        history = [
          {
            event_type: 'placed',
            detail: 'Order received',
            created_at: o.created_at,
          },
        ];
      }
      res.json({
        order: o,
        items,
        history,
        status_label: formatStatusLabel(o.status),
      });
    } catch (err) {
      return sendDbError(res, err);
    }
  }
);

function formatStatusLabel(status) {
  const map = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

export default router;
