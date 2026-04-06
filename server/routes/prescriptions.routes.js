/**
 * Customer prescription upload — image stored on disk, path in DB.
 */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import path from 'path';
import { query } from '../config/database.js';
import { uploadPrescription } from '../middleware/uploadPrescription.js';
import { optionalCustomerAuth } from '../middleware/customerAuth.js';

const router = Router();

router.post(
  '/',
  optionalCustomerAuth,
  uploadPrescription.single('prescription'),
  body('guest_phone').optional().trim().isLength({ max: 32 }),
  body('notes').optional().trim().isLength({ max: 2000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Prescription image is required' });
    }
    const userId = req.user?.id ?? null;
    const guest_phone = req.body.guest_phone || null;
    if (!userId && !guest_phone) {
      return res.status(400).json({ error: 'Provide guest_phone or log in' });
    }
    const relPath = path.join('prescriptions', req.file.filename).replace(/\\/g, '/');
    await query(
      'INSERT INTO prescriptions (user_id, guest_phone, image_path, notes, verified) VALUES (?, ?, ?, ?, ?)',
      [userId, guest_phone, relPath, req.body.notes || null, 'pending']
    );
    res.status(201).json({ message: 'Prescription uploaded. Our pharmacist will verify it soon.' });
  }
);

export default router;
