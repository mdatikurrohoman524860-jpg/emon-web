/**
 * Customer registration & login — bcrypt + JWT (same secret as admin, role in payload).
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';

const router = Router();

function signCustomerToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post(
  '/register',
  body('name').trim().isLength({ min: 2, max: 255 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6, max: 128 }),
  body('phone').optional().trim().isLength({ max: 32 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, password, phone } = req.body;
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, password_hash, phone || null, 'customer']
    );
    const user = { id: result.insertId, name, email, phone: phone || null };
    const token = signCustomerToken(user);
    res.status(201).json({ user: { id: user.id, name, email, phone: user.phone }, token });
  }
);

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
      'SELECT id, name, email, phone, password_hash, role FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length || rows[0].role !== 'customer') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signCustomerToken(user);
    res.json({
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      token,
    });
  }
);

export default router;
