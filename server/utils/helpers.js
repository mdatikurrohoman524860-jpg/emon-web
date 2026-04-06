/**
 * Shared helpers: order reference, slug generation.
 */
import crypto from 'crypto';

export function generateOrderRef() {
  const part = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `OMS${part}`;
}

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
