/**
 * Contact form — persists to DB for admin follow-up.
 */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';

const router = Router();

router.post(
  '/',
  body('name').trim().isLength({ min: 2, max: 255 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 32 }),
  body('message').trim().isLength({ min: 10, max: 5000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, phone, message } = req.body;
    await query(
      'INSERT INTO contact_messages (name, email, phone, message) VALUES (?, ?, ?, ?)',
      [name, email, phone || null, message]
    );
    res.status(201).json({ message: 'Thank you. We will get back to you soon.' });
  }
);

export default router;
