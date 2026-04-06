/**
 * Product reviews — paginated read (latest first) + create.
 */
import { Router } from 'express';
import { body, param, query as qv, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { sendDbError } from '../utils/dbErrors.js';

const router = Router();

router.get(
  '/medicine/:medicineId',
  param('medicineId').isInt({ min: 1 }),
  qv('page').optional().isInt({ min: 1 }),
  qv('limit').optional().isInt({ min: 1, max: 50 }),
  qv('offset').optional().isInt({ min: 0 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { medicineId } = req.params;
      const med = await query('SELECT id FROM medicines WHERE id = ?', [medicineId]);
      if (!med.length) {
        return res.status(404).json({ error: 'Medicine not found' });
      }

      let limit = parseInt(req.query.limit, 10);
      if (Number.isNaN(limit) || limit < 1) limit = 10;
      limit = Math.min(50, limit);

      let offset = 0;
      if (req.query.offset !== undefined && req.query.offset !== '') {
        offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
      } else if (req.query.page !== undefined && req.query.page !== '') {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        offset = (page - 1) * limit;
      }

      const countRows = await query('SELECT COUNT(*) as c FROM reviews WHERE medicine_id = ?', [medicineId]);
      const total = Number(countRows[0]?.c ?? 0);

      const avgRows = await query(
        'SELECT COALESCE(AVG(rating),0) as avg_rating FROM reviews WHERE medicine_id = ?',
        [medicineId]
      );
      const avgNum = Number(avgRows[0]?.avg_rating ?? 0);
      const avgDisplay = total === 0 ? null : avgNum.toFixed(1);

      const rows = await query(
        `SELECT id, user_name, rating, comment, created_at FROM reviews
         WHERE medicine_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [medicineId, limit, offset]
      );

      const has_more = offset + rows.length < total;
      const pageNum = limit > 0 ? Math.floor(offset / limit) + 1 : 1;

      res.json({
        reviews: rows,
        summary: {
          avg_rating: avgDisplay,
          count: total,
        },
        meta: {
          page: pageNum,
          limit,
          offset,
          total,
          has_more,
        },
      });
    } catch (err) {
      return sendDbError(res, err);
    }
  }
);

router.post(
  '/',
  body('medicine_id').isInt({ min: 1 }),
  body('user_name').trim().isLength({ min: 2, max: 255 }),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim().isLength({ max: 2000 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { medicine_id, user_name, rating, comment } = req.body;
      const med = await query('SELECT id FROM medicines WHERE id = ?', [medicine_id]);
      if (!med.length) {
        return res.status(404).json({ error: 'Medicine not found' });
      }
      await query(
        'INSERT INTO reviews (medicine_id, user_name, rating, comment) VALUES (?, ?, ?, ?)',
        [medicine_id, user_name, rating, comment || null]
      );
      res.status(201).json({ message: 'Review submitted' });
    } catch (err) {
      return sendDbError(res, err);
    }
  }
);

export default router;
