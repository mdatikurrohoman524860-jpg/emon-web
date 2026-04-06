/**
 * Seed admin, categories, CMS defaults, sample medicines & slides. Run: npm run seed
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { slugify } from '../server/utils/helpers.js';

dotenv.config();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@medicinestore.bd';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
const ADMIN_NAME = 'Store Admin';

const categoryDefs = [
  { name: 'Tablet', slug: 'tablet', sort: 1 },
  { name: 'Syrup', slug: 'syrup', sort: 2 },
  { name: 'Baby Care', slug: 'baby_care', sort: 3 },
  { name: 'Personal Care', slug: 'personal_care', sort: 4 },
];

const samples = [
  {
    name: 'Paracetamol 500mg',
    catSlug: 'tablet',
    price: 2.5,
    stock: 500,
    description: 'Pain relief and fever — use as directed by physician.',
    image_url: 'https://images.unsplash.com/photo-1584308666741-1d3fda86ccd5?w=400&q=80',
  },
  {
    name: 'Vitamin C 1000mg',
    catSlug: 'tablet',
    price: 120,
    stock: 80,
    description: 'Immune support supplement.',
    image_url: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&q=80',
  },
  {
    name: 'Cough Syrup (Honey)',
    catSlug: 'syrup',
    price: 185,
    stock: 45,
    description: 'Soothing cough relief syrup — 100ml.',
    image_url: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&q=80',
  },
  {
    name: 'Baby Diaper Small',
    catSlug: 'baby_care',
    price: 950,
    stock: 30,
    description: 'Soft disposable diapers — pack of 24.',
    image_url: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&q=80',
  },
  {
    name: 'Hand Sanitizer 200ml',
    catSlug: 'personal_care',
    price: 165,
    stock: 120,
    description: 'Alcohol-based sanitizer for hygiene.',
    image_url: 'https://images.unsplash.com/photo-1584483766117-1c57c2820b8f?w=400&q=80',
  },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await conn.query(
    `INSERT INTO users (name, email, password_hash, phone, role)
     VALUES (?, ?, ?, NULL, 'admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)`,
    [ADMIN_NAME, ADMIN_EMAIL, hash]
  );
  console.log('Admin:', ADMIN_EMAIL);

  for (const c of categoryDefs) {
    await conn.query(
      `INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, '', ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)`,
      [c.name, c.slug, c.sort]
    );
  }
  const [catRows] = await conn.query('SELECT id, slug FROM categories');
  const catIdBySlug = Object.fromEntries(catRows.map((r) => [r.slug, r.id]));

  const settings = [
    ['brand_name', 'Online Medicine Store'],
    ['site_title', 'Online Medicine Store'],
    [
      'footer_description',
      'Licensed pharmacy-style eCommerce for Bangladesh. Cash on delivery and mobile wallet payments.',
    ],
    ['footer_address', 'Dhaka, Bangladesh'],
    ['wallet_bkash', '01XXXXXXXXX'],
    ['wallet_nagad', '01XXXXXXXXX'],
    ['wallet_rocket', '01XXXXXXXXX'],
    ['delivery_label_inside', 'Inside Dhaka'],
    ['delivery_label_outside', 'Outside Dhaka'],
    ['delivery_fee_inside', '60'],
    ['delivery_fee_outside', '120'],
    ['low_stock_threshold', '10'],
  ];
  for (const [k, v] of settings) {
    await conn.query(
      'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [k, v]
    );
  }

  await conn.query('DELETE FROM footer_links');
  await conn.query('DELETE FROM footer_sections');
  await conn.query('DELETE FROM nav_items');
  await conn.query('DELETE FROM hero_slides');

  const nav = [
    ['Home', '/', 1],
    ['Shop', '/shop', 2],
    ['Offer', '/offer', 3],
    ['Contact', '/contact', 4],
    ['About', '/about', 5],
  ];
  for (const [label, url, ord] of nav) {
    await conn.query('INSERT INTO nav_items (label, url_path, sort_order, is_active) VALUES (?, ?, ?, 1)', [
      label,
      url,
      ord,
    ]);
  }

  const [ins1] = await conn.query("INSERT INTO footer_sections (title, sort_order) VALUES ('Quick links', 1)");
  const sid1 = ins1.insertId;
  const [ins2] = await conn.query("INSERT INTO footer_sections (title, sort_order) VALUES ('Support', 2)");
  const sid2 = ins2.insertId;
  await conn.query(
    'INSERT INTO footer_links (section_id, label, url, icon, sort_order) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
    [
      sid1,
      'Shop',
      '/shop',
      '🛒',
      1,
      sid1,
      'Offers',
      '/offer',
      '🏷️',
      2,
      sid2,
      'Contact',
      '/contact',
      '✉️',
      1,
    ]
  );

  await conn.query(
    `INSERT INTO hero_slides (title, description, image_path, link_url, sort_order, is_enabled) VALUES
     (?, ?, ?, ?, 1, 1), (?, ?, ?, ?, 2, 1)`,
    [
      'Trusted medicines to your door',
      'COD, bKash, Nagad & Rocket — order online across Bangladesh.',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&q=80',
      '/shop',
      'Upload prescriptions easily',
      'Our pharmacists verify your Rx before dispensing.',
      'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200&q=80',
      '/offer',
    ]
  );

  for (const m of samples) {
    const cid = catIdBySlug[m.catSlug];
    if (!cid) continue;
    const slug = slugify(m.name);
    await conn.query(
      `INSERT INTO medicines (name, slug, description, category_id, price, stock, expiry_date, image_url)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 365 DAY), ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), category_id = VALUES(category_id)`,
      [m.name, slug, m.description, cid, m.price, m.stock, m.image_url]
    );
  }

  await conn.query(
    `INSERT INTO coupons (code, discount_percent, expiry_date, usage_limit, used_count, apply_to, category_id, product_id, is_active)
     VALUES ('WELCOME10', 10, DATE_ADD(CURDATE(), INTERVAL 180 DAY), 1000, 0, 'all', NULL, NULL, 1)
     ON DUPLICATE KEY UPDATE discount_percent = VALUES(discount_percent)`
  );

  console.log('Seed complete: categories, CMS, nav, footer, slides, medicines, sample coupon WELCOME10.');
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
