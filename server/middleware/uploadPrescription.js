/**
 * Multer config for prescription image uploads (stored under /uploads/prescriptions).
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'prescriptions');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname).slice(0, 8)}`;
    cb(null, safe);
  },
});

function fileFilter(_req, file, cb) {
  const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);
  cb(null, ok);
}

export const uploadPrescription = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});
