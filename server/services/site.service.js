/**
 * Load site settings, navigation, footer, slides for public layout + checkout hints.
 */
import { query } from '../config/database.js';

const DEFAULTS = {
  brand_name: 'Online Medicine Store',
  site_title: 'Online Medicine Store',
  footer_description:
    'Licensed pharmacy-style eCommerce for Bangladesh. Cash on delivery and mobile wallet payments.',
  footer_address: 'Dhaka, Bangladesh',
  wallet_bkash: '01XXXXXXXXX',
  wallet_nagad: '01XXXXXXXXX',
  wallet_rocket: '01XXXXXXXXX',
  delivery_label_inside: 'Inside Dhaka',
  delivery_label_outside: 'Outside Dhaka',
  delivery_fee_inside: '60',
  delivery_fee_outside: '120',
  low_stock_threshold: '10',
  whatsapp_number: '',
};

export async function getSettingsMap() {
  const rows = await query('SELECT setting_key, setting_value FROM site_settings');
  const map = { ...DEFAULTS };
  for (const r of rows) {
    if (r.setting_value != null) map[r.setting_key] = r.setting_value;
  }
  return map;
}

export async function setSetting(key, value) {
  await query(
    'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [key, value == null ? '' : String(value)]
  );
}

export async function setSettingsBatch(pairs) {
  for (const [k, v] of Object.entries(pairs)) {
    await setSetting(k, v);
  }
}

/** Public URLs for uploaded assets (relative to site root). */
export function uploadsUrl(relativePath) {
  if (!relativePath) return '';
  const clean = String(relativePath).replace(/^\//, '');
  return `/uploads/${clean}`;
}

export async function buildPublicLayout() {
  const settings = await getSettingsMap();
  const nav = await query(
    'SELECT id, label, url_path as url FROM nav_items WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
  );
  const sections = await query('SELECT id, title FROM footer_sections ORDER BY sort_order ASC, id ASC');
  const links = await query(
    'SELECT id, section_id, label, url, icon, sort_order FROM footer_links ORDER BY sort_order ASC, id ASC'
  );
  const slides = await query(
    `SELECT id, title, description, image_path, link_url, sort_order
     FROM hero_slides WHERE is_enabled = 1 ORDER BY sort_order ASC, id ASC`
  );
  const categories = await query(
    'SELECT id, name, slug, description, sort_order FROM categories ORDER BY sort_order ASC, name ASC'
  );

  const footer = sections.map((s) => ({
    id: s.id,
    title: s.title,
    links: links.filter((l) => l.section_id === s.id).map((l) => ({ label: l.label, url: l.url, icon: l.icon })),
  }));

  return {
    settings: {
      brand_name: settings.brand_name,
      site_title: settings.site_title,
      favicon_url: settings.favicon_path ? uploadsUrl(settings.favicon_path) : '',
      logo_url: settings.logo_path ? uploadsUrl(settings.logo_path) : '',
      footer_description: settings.footer_description,
      footer_address: settings.footer_address,
    },
    checkout: {
      wallet_bkash: settings.wallet_bkash,
      wallet_nagad: settings.wallet_nagad,
      wallet_rocket: settings.wallet_rocket,
      delivery_label_inside: settings.delivery_label_inside,
      delivery_label_outside: settings.delivery_label_outside,
      delivery_fee_inside: Number(settings.delivery_fee_inside) || 0,
      delivery_fee_outside: Number(settings.delivery_fee_outside) || 0,
      low_stock_threshold: Number(settings.low_stock_threshold) || 10,
      whatsappNumber: (settings.whatsapp_number || process.env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
    },
    nav,
    footer,
    slides: slides.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      image_url: /^https?:\/\//i.test(String(s.image_path || '')) ? s.image_path : uploadsUrl(s.image_path),
      link_url: s.link_url || '',
      sort_order: s.sort_order,
    })),
    categories,
  };
}
