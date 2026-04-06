/**
 * Home: hero slides from layout + featured medicines.
 */
import { apiGet, formatBdt } from './api.js';

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

function renderSlides(slides) {
  const root = document.getElementById('hero-carousel');
  if (!root) return;
  if (!slides?.length) {
    root.innerHTML = `<div class="carousel-slide active"><div class="container"><p class="field-hint">Add slides from the admin panel.</p></div></div>`;
    return;
  }
  root.innerHTML = slides
    .map(
      (s, i) => `
    <div class="carousel-slide ${i === 0 ? 'active' : ''}" data-idx="${i}">
      <img src="${escapeAttr(s.image_url)}" alt="" class="carousel-bg" loading="${i === 0 ? 'eager' : 'lazy'}" />
      <div class="carousel-caption container">
        <h2>${escapeHtml(s.title)}</h2>
        <p>${escapeHtml(s.description || '')}</p>
        ${s.link_url ? `<a class="btn btn-primary" href="${escapeAttr(s.link_url)}">Learn more</a>` : ''}
      </div>
    </div>`
    )
    .join('');
  root.insertAdjacentHTML(
    'beforeend',
    `<div class="carousel-dots">${slides.map((_, i) => `<button type="button" aria-label="Slide ${i + 1}" data-go="${i}"></button>`).join('')}</div>`
  );

  let cur = 0;
  const show = (idx) => {
    cur = (idx + slides.length) % slides.length;
    root.querySelectorAll('.carousel-slide').forEach((el, j) => el.classList.toggle('active', j === cur));
    root.querySelectorAll('.carousel-dots button').forEach((b, j) => b.classList.toggle('active', j === cur));
  };
  root.querySelectorAll('.carousel-dots button').forEach((b) => {
    b.addEventListener('click', () => show(Number(b.dataset.go)));
  });
  setInterval(() => show(cur + 1), 6000);
  root.querySelector('.carousel-slide')?.addEventListener('click', (e) => {
    const slide = slides[cur];
    if (slide?.link_url && !e.target.closest('a')) {
      window.location.href = slide.link_url;
    }
  });
}

async function loadFeatured() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  try {
    const { data } = await apiGet('/api/medicines?limit=4');
    grid.innerHTML = data
      .map(
        (m) => `
      <article class="card">
        <a href="/product?id=${m.id}">
          <img class="card-img" src="${escapeAttr(m.image_url || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&q=80')}" alt="${escapeHtml(m.name)}" width="400" height="300" loading="lazy" />
        </a>
        <div class="card-body">
          <span class="card-meta">${escapeHtml(m.category_name || '')}</span>
          <h3><a href="/product?id=${m.id}">${escapeHtml(m.name)}</a></h3>
          <p class="price">${formatBdt(m.price)}</p>
          <a class="btn btn-primary btn-sm" href="/product?id=${m.id}">View</a>
        </div>
      </article>`
      )
      .join('');
  } catch {
    grid.innerHTML = `<p class="alert alert-error">Could not load products.</p>`;
  }
}

export function initHome() {
  const layout = window.__OMS_LAYOUT;
  if (layout?.slides) renderSlides(layout.slides);
  loadFeatured();
}
