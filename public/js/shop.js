/**
 * Shop: search with suggestions + category filter + pagination.
 */
import { apiGet, formatBdt } from './api.js';

const grid = document.getElementById('shop-grid');
const searchInput = document.getElementById('shop-search');
const suggestBox = document.getElementById('search-suggestions');
const categorySelect = document.getElementById('category-filter');
const pagination = document.getElementById('shop-pagination');
const statusEl = document.getElementById('shop-status');

let page = 1;
let timer;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadCategories() {
  if (!categorySelect) return;
  try {
    const { categories } = await apiGet('/api/medicines/categories/list');
    categorySelect.innerHTML =
      `<option value="">All categories</option>` +
      categories.map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('');
  } catch {
    /* ignore */
  }
}

async function fetchList() {
  if (!grid) return;
  if (statusEl) statusEl.textContent = 'Loading…';
  const params = new URLSearchParams();
  const q = searchInput?.value?.trim();
  const cat = categorySelect?.value;
  if (q) params.set('search', q);
  if (cat) params.set('category', cat);
  params.set('page', String(page));
  params.set('limit', '12');
  try {
    const { data, meta } = await apiGet(`/api/medicines?${params}`);
    grid.innerHTML = data.length
      ? data
          .map(
            (m) => `
      <article class="card">
        <a href="/product?id=${m.id}">
          <img class="card-img" src="${m.image_url || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&q=80'}" alt="${escapeHtml(m.name)}" width="400" height="300" loading="lazy" />
        </a>
        <div class="card-body">
          <span class="card-meta">${escapeHtml(m.category_name || '')}</span>
          <h3><a href="/product?id=${m.id}">${escapeHtml(m.name)}</a></h3>
          <p class="price">${formatBdt(m.price)}</p>
          <a class="btn btn-primary btn-sm" href="/product?id=${m.id}">Details</a>
        </div>
      </article>`
          )
          .join('')
      : '<p>No medicines match your filters.</p>';

    const pages = Math.max(1, Math.ceil(meta.total / meta.limit));
    if (pagination) pagination.innerHTML = '';
    if (pagination && pages > 1) {
      for (let p = 1; p <= pages; p++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm ' + (p === page ? 'btn-primary' : 'btn-outline');
        btn.textContent = String(p);
        btn.addEventListener('click', () => {
          page = p;
          fetchList();
        });
        pagination.appendChild(btn);
      }
    }
    if (statusEl) statusEl.textContent = `${meta.total} products`;
  } catch (e) {
    if (statusEl) statusEl.textContent = '';
    grid.innerHTML = `<p class="alert alert-error">${escapeHtml(e.message)}</p>`;
  }
}

async function loadSuggestions(q) {
  if (!suggestBox || !q || q.length < 2) {
    suggestBox?.classList.remove('open');
    suggestBox && (suggestBox.innerHTML = '');
    return;
  }
  try {
    const { suggestions } = await apiGet(`/api/medicines/suggest?q=${encodeURIComponent(q)}`);
    suggestBox.innerHTML = suggestions
      .map(
        (s) =>
          `<button type="button" data-id="${s.id}">${escapeHtml(s.name)} <small style="color:var(--muted)">(${escapeHtml(s.category_name || '')})</small></button>`
      )
      .join('');
    suggestBox.classList.add('open');
    suggestBox.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        window.location.href = `/product?id=${b.dataset.id}`;
      });
    });
  } catch {
    suggestBox.classList.remove('open');
  }
}

searchInput?.addEventListener('input', () => {
  page = 1;
  clearTimeout(timer);
  timer = setTimeout(() => fetchList(), 280);
  const q = searchInput.value.trim();
  clearTimeout(suggestBox._t);
  suggestBox._t = setTimeout(() => loadSuggestions(q), 200);
});

categorySelect?.addEventListener('change', () => {
  page = 1;
  fetchList();
});

document.addEventListener('click', (e) => {
  if (!suggestBox || !searchInput) return;
  if (!suggestBox.contains(e.target) && e.target !== searchInput) {
    suggestBox.classList.remove('open');
  }
});

loadCategories().then(() => fetchList());
