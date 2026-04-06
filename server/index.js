/**
 * Online Medicine Store — Express entry.
 * Serves REST API + static frontend + uploads.
 * Set TRUST_PROXY=1 when behind HTTPS reverse proxy (nginx / cPanel).
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes.js';
import medicinesRoutes from './routes/medicines.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import reviewsRoutes from './routes/reviews.routes.js';
import prescriptionsRoutes from './routes/prescriptions.routes.js';
import contactRoutes from './routes/contact.routes.js';
import adminRoutes from './routes/admin.routes.js';
import publicRoutes from './routes/public.routes.js';
import { buildPublicLayout } from './services/site.service.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/auth', authLimiter);
app.use('/api/admin/login', authLimiter);

app.use('/api/public', publicRoutes);

/** Back-compat small config; prefer /api/public/layout for full CMS data. */
app.get('/api/config', async (_req, res) => {
  try {
    const data = await buildPublicLayout();
    res.json({
      siteName: data.settings.brand_name,
      whatsappNumber: data.checkout.whatsappNumber || '',
      currency: 'BDT',
    });
  } catch {
    res.json({
      siteName: 'Online Medicine Store',
      whatsappNumber: (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
      currency: 'BDT',
    });
  }
});

/** Uptime / load-balancer probe (no DB ping — add if you need deep checks). */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/prescriptions', prescriptionsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

const uploadsDir = path.join(rootDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.use(express.static(publicDir, { index: 'index.html', extensions: ['html'] }));

/** SPA-style fallback for direct loads of routes that are client HTML pages. */
const clientPages = [
  'shop',
  'product',
  'cart',
  'checkout',
  'login',
  'upload-prescription',
  'contact',
  'track',
  'about',
  'offer',
  'my-orders',
];
for (const page of clientPages) {
  app.get(`/${page}`, (_req, res) => {
    res.sendFile(path.join(publicDir, `${page}.html`));
  });
}
/** Admin panel HTML pages (separate files for shared-hosting simplicity). */
const adminPages = [
  'login',
  'dashboard',
  'medicines',
  'orders',
  'prescriptions',
  'users',
  'stock',
  'messages',
  'appearance',
  'navigation',
  'footer',
  'slides',
  'categories',
  'coupons',
];
for (const p of adminPages) {
  app.get(`/admin/${p}`, (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin', `${p}.html`));
  });
}
app.get('/admin', (_req, res) => {
  res.redirect(302, '/admin/login');
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Online Medicine Store listening on http://localhost:${PORT}`);
});
