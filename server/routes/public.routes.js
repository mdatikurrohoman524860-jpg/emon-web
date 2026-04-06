/**
 * Public read-only layout + coupon validation (no auth).
 */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { buildPublicLayout } from '../services/site.service.js';
import { validateCouponForCart } from '../services/coupon.service.js';

const router = Router();

router.get('/layout', async (_req, res) => {
  try {
    const data = await buildPublicLayout();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load layout' });
  }
});

router.post(
  '/coupons/validate',
  body('code').trim().notEmpty(),
  body('items').isArray({ min: 1 }),
  body('items.*.medicineId').isInt({ min: 1 }),
  body('items.*.quantity').isInt({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const result = await validateCouponForCart(req.body.code, req.body.items);
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }
      res.json({
        discount_percent: result.discount_percent,
        discount_amount: result.discount_amount,
        subtotal: result.subtotal,
        coupon_id: result.coupon_id,
        code: result.code,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Validation failed' });
    }
  }
);

export default router;
