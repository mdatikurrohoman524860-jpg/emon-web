# Online Medicine Store

Responsive pharmacy eCommerce for Bangladesh: **Express + MySQL** REST API, static storefront, JWT admin panel, prescription uploads, COD + bKash + Nagad + Rocket, order tracking, WhatsApp ordering, and customer reviews.

## Folder structure

- `server/` — Express app (`index.js`), route modules, middleware, DB pool.
- `public/` — Customer-facing HTML/CSS/JS, `robots.txt`, `sitemap.xml`.
- `public/admin/` — Admin UI (separate pages + `js/admin-api.js`).
- `database/schema.sql` — MySQL schema (v2: dynamic categories, CMS tables, coupons, extended orders).
- `scripts/seed.js` — Admin user, categories, CMS defaults, sample medicines, demo coupon `WELCOME10`.
- `server/services/` — Site layout builder, coupon validation, order notifications (optional SMTP).
- `uploads/prescriptions/` — Created at runtime for Rx images (gitignored).

## Setup

1. **Node.js 18+** and **MySQL 5.7+ / 8+**.
2. Create a database and import the schema (if upgrading from an older dump, back up data then re-import or migrate manually — v2 changes `medicines`, `orders`, and adds CMS/coupon tables):

   ```bash
   mysql -u USER -p DB_NAME < database/schema.sql
   ```

3. Copy `.env.example` to `.env` and set `DB_*`, `JWT_SECRET` (long random string), `PORT`, and optional `WHATSAPP_NUMBER` (e.g. `8801712345678` without `+`).

4. Install and seed:

   ```bash
   npm install
   npm run seed
   ```

   Default admin (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`):

   - Email: `admin@medicinestore.bd`
   - Password: `Admin@123456`

5. Run:

   ```bash
   npm start
   ```

   Storefront: `http://localhost:3000`  
   Admin: `http://localhost:3000/admin/login`

## Environment variables

See `.env.example`. **Never commit `.env`.** Use strong `JWT_SECRET` in production.

## HTTPS / reverse proxy

Behind nginx or cPanel SSL termination, set `TRUST_PROXY=1` so Express respects `X-Forwarded-*` headers for correct client IPs and secure cookies if you add them later.

## Shared hosting

Classic **PHP-only** shared hosting cannot run this Node stack. Options:

- A host that supports **Node.js** (some providers offer this in cPanel).
- **VPS** (DigitalOcean, Linode, etc.) with Node + MySQL + PM2 + nginx.
- **PaaS** (Railway, Render, Fly.io) with MySQL addon.

Upload the project, set env vars in the panel, run `npm install`, `npm run seed`, and start with `npm start` or your host’s process manager. Point the web root to the app URL (proxy to `PORT`).

## SEO

Per-page `<title>` / `<meta name="description">`, JSON-LD on home, `robots.txt`, and `sitemap.xml`. Replace relative `loc` entries in `sitemap.xml` with your full `https://yourdomain.com/...` URLs when you deploy.

## Security notes

- Admin and customer JWTs use `JWT_SECRET`; admin routes require `role: admin` in the token.
- Passwords hashed with **bcrypt** (cost 12 for customers; admin seed same).
- **Helmet**, **compression**, **express-rate-limit** on auth/admin login, **express-validator** on inputs.
- **Multer** limits file type/size for prescriptions.
- For production, terminate TLS at the proxy, keep dependencies updated, and restrict MySQL access.

## API overview

| Area | Method | Path |
|------|--------|------|
| Layout (nav, footer, slides, settings, checkout hints) | GET | `/api/public/layout` |
| Validate coupon | POST | `/api/public/coupons/validate` |
| Config | GET | `/api/config` |
| Auth | POST | `/api/auth/register`, `/api/auth/login` |
| Medicines | GET | `/api/medicines`, `/api/medicines/suggest?q=`, `/api/medicines/categories/list`, `/api/medicines/:idOrSlug` |
| Orders | POST | `/api/orders` (optional `Authorization: Bearer` for linked user) |
| Track | GET | `/api/orders/track?ref=&phone=` |
| Reviews | GET | `/api/reviews/medicine/:id` |
| Reviews | POST | `/api/reviews` |
| Prescriptions | POST | `/api/prescriptions` (multipart field `prescription`) |
| Contact | POST | `/api/contact` |
| Admin | POST | `/api/admin/login` |
| Admin | * | `/api/admin/*` (Bearer admin JWT) |

Prescription files are served under `/uploads/...` (consider restricting in production).
