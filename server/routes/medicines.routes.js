/**
 * Public medicine catalog: list, search suggestions, single product (dynamic categories).
 */
import { Router } from 'express';
import { query } from '../config/database.js';
import { param, query as qv } from 'express-validator';
import { validationResult } from 'express-validator';

const router = Router();

router.get('/categories/list', async (_req, res) => {
  const rows = await query(
    'SELECT id, name, slug, description, sort_order FROM categories ORDER BY sort_order ASC, name ASC'
  );
  res.json({ categories: rows.map((c) => ({ id: c.id, slug: c.slug, label: c.name, description: c.description })) });
});

router.get(
  '/suggest',
  qv('q').trim().isLength({ min: 1, max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ suggestions: [] });
    }
    const term = `%${req.query.q}%`;
    const rows = await query(
      `SELECT m.id, m.name, m.slug, c.slug AS category_slug, c.name AS category_name
       FROM medicines m
       JOIN categories c ON c.id = m.category_id
       WHERE m.name LIKE ? ORDER BY m.name ASC LIMIT 8`,
      [term]
    );
    res.json({ suggestions: rows });
  }
);

router.get('/', async (req, res) => {
  const { search, category, page = '1', limit = '12' } = req.query;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(48, Math.max(1, parseInt(limit, 10) || 12));
  const offset = (p - 1) * lim;

  let where = 'WHERE 1=1';
  const params = [];

  if (category) {
    const catId = parseInt(category, 10);
    if (!Number.isNaN(catId)) {
      where += ' AND m.category_id = ?';
      params.push(catId);
    } else {
      where += ' AND c.slug = ?';
      params.push(String(category));
    }
  }
  if (search && String(search).trim()) {
    const t = `%${String(search).trim()}%`;
    where += ' AND (m.name LIKE ? OR m.description LIKE ?)';
    params.push(t, t);
  }

  const countRows = await query(
    `SELECT COUNT(*) as c FROM medicines m JOIN categories c ON c.id = m.category_id ${where}`,
    params
  );
  const total = Number(countRows[0]?.c) || 0;

  const rows = await query(
    `SELECT m.id, m.name, m.slug, m.description, m.category_id, c.slug AS category_slug, c.name AS category_name,
            m.price, m.stock, m.expiry_date, m.image_url
     FROM medicines m JOIN categories c ON c.id = m.category_id
     ${where} ORDER BY m.name ASC LIMIT ? OFFSET ?`,
    [...params, lim, offset]
  );

  res.json({
    data: rows,
    meta: { page: p, limit: lim, total },
  });
});

router.get(
  '/:idOrSlug',
  param('idOrSlug').notEmpty(),
  async (req, res) => {
    const key = req.params.idOrSlug;
    const isNum = /^\d+$/.test(key);
    const rows = isNum
      ? await query(
          `SELECT m.*, c.slug AS category_slug, c.name AS category_name FROM medicines m
           JOIN categories c ON c.id = m.category_id WHERE m.id = ?`,
          [key]
        )
      : await query(
          `SELECT m.*, c.slug AS category_slug, c.name AS category_name FROM medicines m
           JOIN categories c ON c.id = m.category_id WHERE m.slug = ?`,
          [key]
        );
    if (!rows.length) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    res.json(rows[0]);
  }
);

export default router;
