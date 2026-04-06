/**
 * Shared header/footer from /api/public/layout — brand, favicon, logo, nav, footer.
 * Removes reliance on hard-coded Upload/Track links (managed in admin).
 */
import { CartStore } from './cart-store.js';

const currentPage = document.body.dataset.page || '';

/** Fresh fetch every load so admin CMS changes appear immediately. */
export async function fetchLayout() {
  const r = await fetch('/api/public/layout', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('Layout load failed');
  return r.json();
}

function cacheBustAssetUrl(href) {
  if (!href) return '';
  try {
    const abs = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
    return `${abs}${abs.includes('?') ? '&' : '?'}cb=${Date.now()}`;
  } catch {
    return href;
  }
}

function setFavicon(href) {
  if (!href) return;
  const url = cacheBustAssetUrl(href);
  const ensureLink = (rel) => {
    let link = document.querySelector(`link[rel='${rel}']`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = url;
  };
  ensureLink('icon');
  ensureLink('shortcut icon');
  let apple = document.querySelector("link[rel='apple-touch-icon']");
  if (!apple) {
    apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    document.head.appendChild(apple);
  }
  apple.href = url;
}

function applySiteTitle(layout) {
  const tab = layout?.settings?.site_title || layout?.settings?.brand_name || 'Online Medicine Store';
  const pt = document.body.dataset.pageTitle;
  if (currentPage === 'home') {
    document.title = `${tab} — Pharmacy eCommerce Bangladesh`;
  } else if (pt) {
    document.title = `${pt} | ${tab}`;
  }
}

function headerHtml(layout) {
  const s = layout.settings;
  const logoUrl = s.logo_url;
  const brand = escapeHtml(s.brand_name || 'Store');
  const logoSrc = logoUrl ? cacheBustAssetUrl(logoUrl) : '';
  const logoBlock = logoUrl
    ? `<img src="${escapeAttr(logoSrc)}" alt="" class="logo-img" width="40" height="40" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'logo-mark',textContent:'Rx'}))" />`
    : `<span class="logo-mark">Rx</span>`;

  const navItems = (layout.nav || [])
    .filter((n) => Number(n.is_active) !== 0)
    .map((n) => {
      const href = n.url || n.url_path || '/';
      const active =
        (currentPage === 'home' && (href === '/' || href === '')) ||
        (currentPage === 'shop' && href.includes('/shop')) ||
        (currentPage === 'contact' && href.includes('/contact')) ||
        (currentPage === 'about' && href.includes('/about')) ||
        (currentPage === 'offer' && href.includes('/offer'));
      return `<a href="${escapeAttr(href)}" ${active ? `aria-current="page"` : ''}>${escapeHtml(n.label)}</a>`;
    })
    .join('');

  return `
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="/" title="${brand}">
        ${logoBlock}
        <span class="logo-text">${brand}</span>
      </a>
      <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="main-nav">Menu</button>
      <nav id="main-nav" class="nav-main" aria-label="Primary">
        ${navItems}
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost badge-cart" id="nav-cart" href="/cart" data-count="0">Cart</a>
        <a class="btn btn-outline btn-sm" href="/login">Account</a>
      </div>
    </div>
  </header>`;
}

function footerHtml(layout) {
  const s = layout.settings;
  const brand = escapeHtml(s.brand_name || 'Store');
  const desc = escapeHtml(s.footer_description || '');
  const addr = escapeHtml(s.footer_address || '');

  const cols = (layout.footer || [])
    .map((sec) => {
      const links = (sec.links || [])
        .map(
          (l) =>
            `<p><a href="${escapeAttr(l.url)}">${l.icon ? `<span class="footer-icon" aria-hidden="true">${escapeHtml(l.icon)}</span> ` : ''}${escapeHtml(l.label)}</a></p>`
        )
        .join('');
      return `<div><p class="footer-title">${escapeHtml(sec.title)}</p>${links}</div>`;
    })
    .join('');

  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <p class="footer-title">${brand}</p>
        <p>${desc}</p>
        <p>${addr}</p>
      </div>
      ${cols}
    </div>
  </footer>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function bindNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
}

function refreshCartBadge() {
  const el = document.getElementById('nav-cart');
  if (!el) return;
  const n = CartStore.count();
  el.dataset.count = String(n);
}

export async function initLayout() {
  let layout;
  try {
    layout = await fetchLayout();
  } catch {
    layout = {
      settings: {
        brand_name: 'Online Medicine Store',
        site_title: 'Online Medicine Store',
        favicon_url: '',
        logo_url: '',
        footer_description: '',
        footer_address: '',
      },
      nav: [
        { label: 'Home', url: '/', is_active: 1 },
        { label: 'Shop', url: '/shop', is_active: 1 },
        { label: 'Offer', url: '/offer', is_active: 1 },
        { label: 'Contact', url: '/contact', is_active: 1 },
        { label: 'About', url: '/about', is_active: 1 },
      ],
      footer: [],
      slides: [],
      categories: [],
      checkout: {},
    };
  }

  window.__OMS_LAYOUT = layout;
  setFavicon(layout.settings.favicon_url);
  applySiteTitle(layout);

  const ph = document.getElementById('site-header-placeholder');
  const pf = document.getElementById('site-footer-placeholder');
  if (ph) ph.outerHTML = headerHtml(layout);
  if (pf) pf.outerHTML = footerHtml(layout);
  bindNav();
  refreshCartBadge();
  window.addEventListener('oms-cart-changed', refreshCartBadge);

  const acc = document.querySelector('.header-actions a[href="/login"]');
  if (acc && localStorage.getItem('oms_token')) {
    acc.href = '/my-orders';
    acc.textContent = 'My orders';
  }

  return layout;
}
