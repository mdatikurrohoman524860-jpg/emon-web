/**
 * Multer uploads for favicon, logo, and hero slides (under /uploads).
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(__dirname, '..', '..', 'uploads');

function ensureDir(sub) {
  const d = path.join(baseDir, sub);
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
  return d;
}

function factory(subdir) {
  const dest = ensureDir(subdir);
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dest),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).slice(0, 12) || '.bin';
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
      },
    }),
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      cb(null, /^image\//.test(file.mimetype));
    },
  });
}

const siteMulter = factory('site');
const slidesMulter = factory('slides');

export const uploadFavicon = siteMulter.single('file');
export const uploadLogo = siteMulter.single('file');
export const uploadSlideImage = slidesMulter.single('image');
