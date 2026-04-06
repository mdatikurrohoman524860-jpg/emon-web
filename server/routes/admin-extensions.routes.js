/**
 * Admin CMS: site settings, uploads, nav, footer, slides, categories, coupons, finance dashboard.
 * Mount on same router AFTER requireAdmin (see admin.routes.js).
 */
import path from 'path';
import { body, param, query as qv, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { slugify } from '../utils/helpers.js';
import { getSettingsMap, setSettingsBatch, uploadsUrl } from '../services/site.service.js';
import { uploadFavicon, uploadLogo, uploadSlideImage } from '../middleware/uploadSite.js';
const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export function registerAdminExtensions(router) {
  router.get('/settings/raw', async (_req, res) => {
    const map = await getSettingsMap();
    res.json(map);
  });

  router.post('/settings', async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    const allowed = [
      'brand_name',
      'site_title',
      'footer_description',
      'footer_address',
      'wallet_bkash',
      'wallet_nagad',
      'wallet_rocket',
      'delivery_label_inside',
      'delivery_label_outside',
      'delivery_fee_inside',
      'delivery_fee_outside',
      'low_stock_threshold',
      'whatsapp_number',
    ];
    const pairs = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) pairs[k] = req.body[k];
    }
    await setSettingsBatch(pairs);
    res.json({ message: 'Settings saved' });
  });

  router.post('/upload/favicon', uploadFavicon, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    const rel = path.join('site', req.file.filename).replace(/\\/g, '/');
    await setSettingsBatch({ favicon_path: rel });
    res.json({ path: rel, url: uploadsUrl(rel) });
  });

  router.post('/upload/logo', uploadLogo, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    const rel = path.join('site', req.file.filename).replace(/\\/g, '/');
    await setSettingsBatch({ logo_path: rel });
    res.json({ path: rel, url: uploadsUrl(rel) });
  });

  router.get('/nav', async (_req, res) => {
    const rows = await query('SELECT * FROM nav_items ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  });

  router.post(
    '/nav',
    body('label').trim().isLength({ min: 1, max: 100 }),
    body('url_path').trim().isLength({ min: 1, max: 500 }),
    body('sort_order').optional().isInt(),
    body('is_active').optional().isBoolean(),
    async (req, res) => {
      const verr = validationResult(req);
      if (!verr.isEmpty()) return res.status(400).json({ errors: verr.array() });
      const r = await query(
        'INSERT INTO nav_items (label, url_path, sort_order, is_active) VALUES (?, ?, ?, ?)',
        [
          req.body.label,
          req.body.url_path,
          req.body.sort_order ?? 0,
          req.body.is_active === false ? 0 : 1,
        ]
      );
      res.status(201).json({ id: r.insertId });
    }
  );

  router.patch(
    '/nav/:id',
    param('id').isInt({ min: 1 }),
    body('label').optional().trim().isLength({ min: 1, max: 100 }),
    body('url_path').optional().trim().isLength({ min: 1, max: 500 }),
    body('sort_order').optional().isInt(),
    body('is_active').optional().isBoolean(),
    async (req, res) => {
      const row = (await query('SELECT * FROM nav_items WHERE id = ?', [req.params.id]))[0];
      if (!row) return res.status(404).json({ error: 'Not found' });
      await query(
        'UPDATE nav_items SET label=?, url_path=?, sort_order=?, is_active=? WHERE id=?',
        [
          req.body.label ?? row.label,
          req.body.url_path ?? row.url_path,
          req.body.sort_order ?? row.sort_order,
          req.body.is_active === undefined ? row.is_active : req.body.is_active ? 1 : 0,
          req.params.id,
        ]
      );
      res.json({ message: 'Updated' });
    }
  );

  router.delete('/nav/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    await query('DELETE FROM nav_items WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  });

  router.get('/footer', async (_req, res) => {
    const sections = await query('SELECT * FROM footer_sections ORDER BY sort_order ASC, id ASC');
    const links = await query('SELECT * FROM footer_links ORDER BY sort_order ASC, id ASC');
    res.json({ sections, links });
  });

  router.post(
    '/footer/sections',
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('sort_order').optional().isInt(),
    async (req, res) => {
      const r = await query('INSERT INTO footer_sections (title, sort_order) VALUES (?, ?)', [
        req.body.title,
        req.body.sort_order ?? 0,
      ]);
      res.status(201).json({ id: r.insertId });
    }
  );

  router.patch('/footer/sections/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    const row = (await query('SELECT * FROM footer_sections WHERE id = ?', [req.params.id]))[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    await query('UPDATE footer_sections SET title=?, sort_order=? WHERE id=?', [
      req.body.title ?? row.title,
      req.body.sort_order ?? row.sort_order,
      req.params.id,
    ]);
    res.json({ message: 'Updated' });
  });

  router.delete('/footer/sections/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    await query('DELETE FROM footer_sections WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  });

  router.post(
    '/footer/links',
    body('section_id').isInt({ min: 1 }),
    body('label').trim().isLength({ min: 1, max: 200 }),
    body('url').trim().isLength({ min: 1, max: 1000 }),
    body('icon').optional().trim().isLength({ max: 100 }),
    body('sort_order').optional().isInt(),
    async (req, res) => {
      const r = await query(
        'INSERT INTO footer_links (section_id, label, url, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
        [
          req.body.section_id,
          req.body.label,
          req.body.url,
          req.body.icon || null,
          req.body.sort_order ?? 0,
        ]
      );
      res.status(201).json({ id: r.insertId });
    }
  );

  router.patch('/footer/links/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    const row = (await query('SELECT * FROM footer_links WHERE id = ?', [req.params.id]))[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    await query(
      'UPDATE footer_links SET section_id=?, label=?, url=?, icon=?, sort_order=? WHERE id=?',
      [
        req.body.section_id ?? row.section_id,
        req.body.label ?? row.label,
        req.body.url ?? row.url,
        req.body.icon !== undefined ? req.body.icon : row.icon,
        req.body.sort_order ?? row.sort_order,
        req.params.id,
      ]
    );
    res.json({ message: 'Updated' });
  });

  router.delete('/footer/links/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    await query('DELETE FROM footer_links WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  });

  router.get('/slides', async (_req, res) => {
    const rows = await query('SELECT * FROM hero_slides ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  });

  router.post('/slides', uploadSlideImage, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Image required' });
    const rel = path.join('slides', req.file.filename).replace(/\\/g, '/');
    const title = req.body.title || 'Slide';
    const description = req.body.description || '';
    const link_url = req.body.link_url || null;
    const sort_order = Number(req.body.sort_order) || 0;
    const is_enabled = req.body.is_enabled === '0' || req.body.is_enabled === 'false' ? 0 : 1;
    const r = await query(
      'INSERT INTO hero_slides (title, description, image_path, link_url, sort_order, is_enabled) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description, rel, link_url, sort_order, is_enabled]
    );
    res.status(201).json({ id: r.insertId, image_path: rel });
  });

  router.patch('/slides/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    const row = (await query('SELECT * FROM hero_slides WHERE id = ?', [req.params.id]))[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    await query(
      'UPDATE hero_slides SET title=?, description=?, link_url=?, sort_order=?, is_enabled=? WHERE id=?',
      [
        req.body.title ?? row.title,
        req.body.description !== undefined ? req.body.description : row.description,
        req.body.link_url !== undefined ? req.body.link_url || null : row.link_url,
        req.body.sort_order !== undefined ? Number(req.body.sort_order) : row.sort_order,
        req.body.is_enabled !== undefined ? (req.body.is_enabled ? 1 : 0) : row.is_enabled,
        req.params.id,
      ]
    );
    res.json({ message: 'Updated' });
  });

  router.post('/slides/:id/image', param('id').isInt({ min: 1 }), uploadSlideImage, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Image required' });
    const row = (await query('SELECT * FROM hero_slides WHERE id = ?', [req.params.id]))[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    const rel = path.join('slides', req.file.filename).replace(/\\/g, '/');
    await query('UPDATE hero_slides SET image_path = ? WHERE id = ?', [rel, req.params.id]);
    res.json({ path: rel, url: uploadsUrl(rel) });
  });

  router.delete('/slides/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    await query('DELETE FROM hero_slides WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  });

  router.get('/categories', async (_req, res) => {
    res.json(await query('SELECT * FROM categories ORDER BY sort_order ASC, name ASC'));
  });

  router.post(
    '/categories',
    body('name').trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim(),
    body('sort_order').optional().isInt(),
    async (req, res) => {
      let base = slugify(req.body.name);
      let slug = base;
      let n = 0;
      while (n < 30) {
        const dup = await query('SELECT id FROM categories WHERE slug = ?', [slug]);
        if (!dup.length) break;
        n += 1;
        slug = `${base}-${n}`;
      }
      const r = await query(
        'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)',
        [req.body.name, slug, req.body.description || null, req.body.sort_order ?? 0]
      );
      res.status(201).json({ id: r.insertId, slug });
    }
  );

  router.patch('/categories/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    const row = (await query('SELECT * FROM categories WHERE id = ?', [req.params.id]))[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    const name = req.body.name ?? row.name;
    let slug = row.slug;
    if (req.body.name) {
      let base = slugify(name);
      slug = base;
      let n = 0;
      while (n < 30) {
        const dup = await query('SELECT id FROM categories WHERE slug = ? AND id != ?', [slug, req.params.id]);
        if (!dup.length) break;
        n += 1;
        slug = `${base}-${n}`;
      }
    }
    await query('UPDATE categories SET name=?, slug=?, description=?, sort_order=? WHERE id=?', [
      name,
      slug,
      req.body.description !== undefined ? req.body.description : row.description,
      req.body.sort_order ?? row.sort_order,
      req.params.id,
    ]);
    res.json({ message: 'Updated' });
  });

  router.delete('/categories/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    const [cnt] = await query('SELECT COUNT(*) as c FROM medicines WHERE category_id = ?', [req.params.id]);
    if (Number(cnt.c) > 0) {
      return res.status(400).json({ error: 'Reassign or delete medicines in this category first' });
    }
    await query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  });

  router.get('/coupons', async (_req, res) => {
    res.json(await query('SELECT * FROM coupons ORDER BY id DESC'));
  });

  router.post(
    '/coupons',
    body('code').trim().isLength({ min: 2, max: 64 }),
    body('discount_percent').isFloat({ min: 0, max: 100 }),
    body('expiry_date').isISO8601().toDate(),
    body('usage_limit').isInt({ min: 0 }),
    body('apply_to').isIn(['all', 'category', 'product']),
    body('category_id').optional().isInt({ min: 1 }),
    body('product_id').optional().isInt({ min: 1 }),
    async (req, res) => {
      const verr = validationResult(req);
      if (!verr.isEmpty()) return res.status(400).json({ errors: verr.array() });
      const code = String(req.body.code).toUpperCase();
      const exp =
        req.body.expiry_date instanceof Date
          ? req.body.expiry_date.toISOString().slice(0, 10)
          : req.body.expiry_date;
      const active = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;
      const r = await query(
        `INSERT INTO coupons (code, discount_percent, expiry_date, usage_limit, used_count, apply_to, category_id, product_id, is_active)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        [
          code,
          req.body.discount_percent,
          exp,
          req.body.usage_limit,
          req.body.apply_to,
          req.body.apply_to === 'category' ? req.body.category_id || null : null,
          req.body.apply_to === 'product' ? req.body.product_id || null : null,
          active,
        ]
      );
      res.status(201).json({ id: r.insertId });
    }
  );

  router.patch('/coupons/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    const row = (await query('SELECT * FROM coupons WHERE id = ?', [req.params.id]))[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    await query(
      `UPDATE coupons SET code=?, discount_percent=?, expiry_date=?, usage_limit=?, apply_to=?, category_id=?, product_id=?, is_active=? WHERE id=?`,
      [
        req.body.code ? String(req.body.code).toUpperCase() : row.code,
        req.body.discount_percent ?? row.discount_percent,
        req.body.expiry_date
          ? new Date(req.body.expiry_date).toISOString().slice(0, 10)
          : row.expiry_date,
        req.body.usage_limit ?? row.usage_limit,
        req.body.apply_to ?? row.apply_to,
        req.body.category_id !== undefined ? req.body.category_id : row.category_id,
        req.body.product_id !== undefined ? req.body.product_id : row.product_id,
        req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : row.is_active,
        req.params.id,
      ]
    );
    res.json({ message: 'Updated' });
  });

  router.delete('/coupons/:id', param('id').isInt({ min: 1 }), async (req, res) => {
    await query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  });

  router.get('/dashboard/finance', async (_req, res) => {
    const today = await query(
      `SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelled' AND DATE(created_at) = CURDATE()`
    );
    const week = await query(
      `SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
    );
    const month = await query(
      `SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
    );
    const all = await query(
      `SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelled'`
    );
    const completed = await query(`SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'`);
    const cancelled = await query(`SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'`);
    const pending = await query(`SELECT COUNT(*) as c FROM orders WHERE status IN ('pending','processing','shipped')`);
    const payBreak = await query(
      `SELECT payment_method, COUNT(*) as cnt, COALESCE(SUM(total),0) as revenue FROM orders WHERE status != 'cancelled' GROUP BY payment_method`
    );
    const last7 = await query(
      `SELECT DATE(created_at) as d, COALESCE(SUM(total),0) as revenue
       FROM orders WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at) ORDER BY d ASC`
    );
    const catStats = await query(
      `SELECT c.id, c.name, COUNT(m.id) as products FROM categories c
       LEFT JOIN medicines m ON m.category_id = c.id GROUP BY c.id ORDER BY c.sort_order`
    );
    const settings = await getSettingsMap();
    const th = Number(settings.low_stock_threshold) || 10;
    const lowStock = await query(
      'SELECT id, name, stock FROM medicines WHERE stock < ? ORDER BY stock ASC LIMIT 50',
      [th]
    );

    const orderCountRows = await query(`SELECT COUNT(*) as c FROM orders`);
    const totalOrders = Number(orderCountRows[0]?.c ?? 0);
    const hasTransactions = totalOrders > 0;

    res.json({
      meta: {
        order_count: totalOrders,
        has_transactions: hasTransactions,
      },
      income: {
        daily: hasTransactions ? Number(today[0]?.s ?? 0) : null,
        weekly: hasTransactions ? Number(week[0]?.s ?? 0) : null,
        monthly: hasTransactions ? Number(month[0]?.s ?? 0) : null,
        total: hasTransactions ? Number(all[0]?.s ?? 0) : null,
      },
      orders: {
        completed: hasTransactions ? Number(completed[0]?.c ?? 0) : null,
        cancelled: hasTransactions ? Number(cancelled[0]?.c ?? 0) : null,
        open: hasTransactions ? Number(pending[0]?.c ?? 0) : null,
      },
      payment_breakdown: hasTransactions ? payBreak : [],
      chart_last7_days: hasTransactions ? last7 : [],
      categories: catStats,
      low_stock_alert: { threshold: th, items: lowStock },
    });
  });

  router.get(
    '/orders-search',
    qv('q').optional().trim(),
    qv('status').optional().trim(),
    qv('payment_method').optional().trim(),
    qv('from').optional().trim(),
    qv('to').optional().trim(),
    async (req, res) => {
      let sql = `SELECT DISTINCT o.* FROM orders o`;
      const params = [];
      const where = [];
      if (req.query.q) {
        const term = `%${req.query.q}%`;
        sql += ` LEFT JOIN order_items oi ON oi.order_id = o.id LEFT JOIN medicines m ON m.id = oi.medicine_id`;
        where.push(
          `(o.order_ref LIKE ? OR o.guest_phone LIKE ? OR o.guest_name LIKE ? OR o.guest_email LIKE ? OR m.name LIKE ?)`
        );
        params.push(term, term, term, term, term);
      }
      if (req.query.status && ORDER_STATUSES.includes(req.query.status)) {
        where.push('o.status = ?');
        params.push(req.query.status);
      }
      if (req.query.payment_method && ['cod', 'bkash', 'nagad', 'rocket'].includes(req.query.payment_method)) {
        where.push('o.payment_method = ?');
        params.push(req.query.payment_method);
      }
      if (req.query.from) {
        where.push('DATE(o.created_at) >= ?');
        params.push(req.query.from);
      }
      if (req.query.to) {
        where.push('DATE(o.created_at) <= ?');
        params.push(req.query.to);
      }
      if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
      sql += ' ORDER BY o.created_at DESC LIMIT 300';
      res.json(await query(sql, params));
    }
  );
}
