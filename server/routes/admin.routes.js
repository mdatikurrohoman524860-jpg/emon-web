/**
 * Admin REST API: dashboard, medicines CRUD, orders, prescriptions, users, stock/expiry.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, param, query as qv, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { slugify } from '../utils/helpers.js';
import { registerAdminExtensions } from './admin-extensions.routes.js';
import { getSettingsMap } from '../services/site.service.js';
import { notifyOrderStatusChange } from '../services/notify.service.js';

const router = Router();

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const PRESCRIPTION_STATUS = ['pending', 'approved', 'rejected'];

/** Admin login — issues JWT (role must be admin in users table). */
router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const rows = await query(
      'SELECT id, email, name, password_hash, role FROM users WHERE email = ? AND role = ?',
      [email, 'admin']
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const admin = rows[0];
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { sub: admin.id, email: admin.email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  }
);

router.use(requireAdmin);

router.get('/dashboard', async (_req, res) => {
  const [ordersRow, salesRow, usersRow, pendingRx] = await Promise.all([
    query('SELECT COUNT(*) as c FROM orders'),
    query('SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != ?', ['cancelled']),
    query("SELECT COUNT(*) as c FROM users WHERE role = 'customer'"),
    query("SELECT COUNT(*) as c FROM prescriptions WHERE verified = 'pending'"),
  ]);
  res.json({
    total_orders: Number(ordersRow[0]?.c ?? 0),
    total_sales_bdt: Number(salesRow[0]?.s ?? 0),
    total_customers: Number(usersRow[0]?.c ?? 0),
    pending_prescriptions: Number(pendingRx[0]?.c ?? 0),
  });
});

router.get('/medicines', async (req, res) => {
  const { search, category } = req.query;
  let sql =
    'SELECT m.*, c.name as category_name, c.slug as category_slug FROM medicines m JOIN categories c ON c.id = m.category_id WHERE 1=1';
  const params = [];
  if (category) {
    const cid = parseInt(category, 10);
    if (!Number.isNaN(cid)) {
      sql += ' AND m.category_id = ?';
      params.push(cid);
    }
  }
  if (search && String(search).trim()) {
    sql += ' AND m.name LIKE ?';
    params.push(`%${String(search).trim()}%`);
  }
  sql += ' ORDER BY m.id DESC';
  const rows = await query(sql, params);
  res.json(rows);
});

router.post(
  '/medicines',
  body('name').trim().isLength({ min: 2, max: 255 }),
  body('description').optional().trim(),
  body('category_id').isInt({ min: 1 }),
  body('price').isFloat({ min: 0 }),
  body('stock').isInt({ min: 0 }),
  body('expiry_date').optional().isISO8601().toDate(),
  body('image_url').optional().trim().isLength({ max: 500 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    let { name, description, category_id, price, stock, expiry_date, image_url } = req.body;
    let base = slugify(name);
    let slug = base;
    let n = 0;
    while (n < 20) {
      const dup = await query('SELECT id FROM medicines WHERE slug = ?', [slug]);
      if (!dup.length) break;
      n += 1;
      slug = `${base}-${n}`;
    }
    const exp =
      expiry_date instanceof Date
        ? expiry_date.toISOString().slice(0, 10)
        : expiry_date || null;
    const result = await query(
      `INSERT INTO medicines (name, slug, description, category_id, price, stock, expiry_date, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, slug, description || null, category_id, price, stock, exp, image_url || null]
    );
    res.status(201).json({ id: result.insertId, slug });
  }
);

router.patch(
  '/medicines/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().isLength({ min: 2, max: 255 }),
  body('description').optional().trim(),
  body('category_id').optional().isInt({ min: 1 }),
  body('price').optional().isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  body('expiry_date')
    .optional({ nullable: true })
    .custom((v) => v === null || v === '' || v instanceof Date || !Number.isNaN(Date.parse(String(v)))),
  body('image_url').optional({ nullable: true }).trim().isLength({ max: 500 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const id = req.params.id;
    const existing = await query('SELECT * FROM medicines WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    const cur = existing[0];
    const name = req.body.name ?? cur.name;
    let slug = cur.slug;
    if (req.body.name) {
      let base = slugify(name);
      slug = base;
      let n = 0;
      while (n < 20) {
        const dup = await query('SELECT id FROM medicines WHERE slug = ? AND id != ?', [slug, id]);
        if (!dup.length) break;
        n += 1;
        slug = `${base}-${n}`;
      }
    }
    const row = {
      name,
      slug,
      description: req.body.description !== undefined ? req.body.description : cur.description,
      category_id: req.body.category_id ?? cur.category_id,
      price: req.body.price !== undefined ? req.body.price : cur.price,
      stock: req.body.stock !== undefined ? req.body.stock : cur.stock,
      expiry_date:
        req.body.expiry_date !== undefined
          ? req.body.expiry_date === null || req.body.expiry_date === ''
            ? null
            : req.body.expiry_date instanceof Date
              ? req.body.expiry_date.toISOString().slice(0, 10)
              : String(req.body.expiry_date).slice(0, 10)
          : cur.expiry_date,
      image_url: req.body.image_url !== undefined ? req.body.image_url : cur.image_url,
    };
    await query(
      `UPDATE medicines SET name=?, slug=?, description=?, category_id=?, price=?, stock=?, expiry_date=?, image_url=? WHERE id=?`,
      [
        row.name,
        row.slug,
        row.description,
        row.category_id,
        row.price,
        row.stock,
        row.expiry_date,
        row.image_url,
        id,
      ]
    );
    res.json({ message: 'Updated' });
  }
);

router.delete('/medicines/:id', param('id').isInt({ min: 1 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  await query('DELETE FROM medicines WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

router.get('/orders', async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (status && ORDER_STATUSES.includes(status)) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const rows = await query(sql, params);
  res.json(rows);
});

router.get('/orders/:id', param('id').isInt({ min: 1 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const orders = await query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!orders.length) {
    return res.status(404).json({ error: 'Not found' });
  }
  const items = await query(
    `SELECT oi.*, m.name as medicine_name FROM order_items oi JOIN medicines m ON m.id = oi.medicine_id WHERE oi.order_id = ?`,
    [req.params.id]
  );
  const history = await query(
    `SELECT event_type, detail, created_at FROM order_events WHERE order_id = ? ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json({ order: orders[0], items, history });
});

router.patch(
  '/orders/:id/status',
  param('id').isInt({ min: 1 }),
  body('status').isIn(ORDER_STATUSES),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const existing = await query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    await query('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    const updated = { ...existing[0], status: req.body.status };
    notifyOrderStatusChange(updated, req.body.status).catch(() => {});
    res.json({ message: 'Status updated' });
  }
);

router.get('/prescriptions', async (_req, res) => {
  const rows = await query(
    `SELECT p.*, u.name as user_name, u.email as user_email FROM prescriptions p
     LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 200`
  );
  res.json(rows);
});

router.patch(
  '/prescriptions/:id',
  param('id').isInt({ min: 1 }),
  body('verified').isIn(PRESCRIPTION_STATUS),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    await query('UPDATE prescriptions SET verified = ? WHERE id = ?', [req.body.verified, req.params.id]);
    res.json({ message: 'Prescription updated' });
  }
);

router.get('/users', async (_req, res) => {
  const rows = await query(
    "SELECT id, name, email, phone, role, created_at FROM users WHERE role = 'customer' ORDER BY id DESC LIMIT 500"
  );
  res.json(rows);
});

/** Stock overview: low stock + expiry within 90 days */
router.get('/stock', async (_req, res) => {
  const settings = await getSettingsMap();
  const th = Number(settings.low_stock_threshold) || 10;
  const low = await query(
    'SELECT id, name, stock, expiry_date FROM medicines WHERE stock < ? ORDER BY stock ASC',
    [th]
  );
  const expiring = await query(
    `SELECT id, name, stock, expiry_date FROM medicines
     WHERE expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
     ORDER BY expiry_date ASC`
  );
  res.json({ low_stock: low, expiring_soon: expiring });
});

router.get('/contact-messages', async (_req, res) => {
  const rows = await query('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200');
  res.json(rows);
});

registerAdminExtensions(router);

export default router;
