/**
 * Product detail, add to cart, reviews (preview + load more), WhatsApp CTA.
 */
import { apiGet, apiPost, formatBdt, getPublicConfig, whatsappOrderLink } from './api.js';
import { CartStore } from './cart-store.js';

const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const root = document.getElementById('product-root');
const reviewsEl = document.getElementById('reviews-list');
const reviewForm = document.getElementById('review-form');
const reviewSummary = document.getElementById('review-summary');
const btnViewAll = document.getElementById('btn-view-all-reviews');
const btnLoadMore = document.getElementById('btn-load-more-reviews');
const reviewsWrap = document.getElementById('reviews-expand-wrap');

const INITIAL_LIMIT = 3;
const MORE_LIMIT = 5;

let reviewsExpanded = false;
let accumulated = [];
let nextOffset = 0;
let totalReviews = 0;
let hasMore = false;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function reviewCard(r) {
  return `
        <div class="review-item">
          <div class="review-head">
            <strong>${escapeHtml(r.user_name)}</strong>
            <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          </div>
          <p>${escapeHtml(r.comment || '')}</p>
          <small class="field-hint">${new Date(r.created_at).toLocaleString()}</small>
        </div>`;
}

function setSummary(summary) {
  if (!reviewSummary) return;
  const count = summary?.count ?? 0;
  const avg = summary?.avg_rating;
  if (!count) {
    reviewSummary.textContent = 'No reviews yet — be the first.';
    return;
  }
  const avgPart = avg != null ? `${avg} ★ average · ` : '';
  reviewSummary.textContent = `${avgPart}${count} review${count === 1 ? '' : 's'}`;
}

function renderReviewList() {
  if (!reviewsEl) return;
  const slice = reviewsExpanded ? accumulated : accumulated.slice(0, INITIAL_LIMIT);
  reviewsEl.innerHTML = slice.length
    ? slice.map((r) => reviewCard(r)).join('')
    : '<p class="field-hint">No reviews yet. Be the first.</p>';
}

function syncReviewActions() {
  if (!btnViewAll || !btnLoadMore || !reviewsWrap) return;
  if (totalReviews <= INITIAL_LIMIT) {
    btnViewAll.hidden = true;
    btnLoadMore.hidden = true;
    reviewsWrap.classList.remove('reviews-expanded');
    return;
  }
  btnViewAll.hidden = reviewsExpanded;
  btnLoadMore.hidden = !reviewsExpanded || !hasMore;
  if (reviewsExpanded) reviewsWrap.classList.add('reviews-expanded');
  else reviewsWrap.classList.remove('reviews-expanded');
}

async function fetchReviews(limit, offset) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiGet(`/api/reviews/medicine/${id}?${q}`);
}

async function initReviews() {
  if (!id || !reviewsEl) return;
  reviewsExpanded = false;
  accumulated = [];
  nextOffset = 0;
  try {
    const data = await fetchReviews(INITIAL_LIMIT, 0);
    accumulated = data.reviews || [];
    nextOffset = accumulated.length;
    totalReviews = data.meta?.total ?? data.summary?.count ?? 0;
    hasMore = Boolean(data.meta?.has_more);
    setSummary(data.summary);
    renderReviewList();
    syncReviewActions();
  } catch {
    reviewsEl.innerHTML = '<p>Could not load reviews.</p>';
    if (reviewSummary) reviewSummary.textContent = '';
  }
}

btnViewAll?.addEventListener('click', () => {
  reviewsExpanded = true;
  renderReviewList();
  syncReviewActions();
  reviewsWrap?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

btnLoadMore?.addEventListener('click', async () => {
  if (!id || !hasMore) return;
  btnLoadMore.disabled = true;
  try {
    const data = await fetchReviews(MORE_LIMIT, nextOffset);
    const batch = data.reviews || [];
    accumulated = accumulated.concat(batch);
    nextOffset += batch.length;
    hasMore = Boolean(data.meta?.has_more);
    renderReviewList();
    syncReviewActions();
  } catch {
    alert('Could not load more reviews.');
  } finally {
    btnLoadMore.disabled = false;
  }
});

async function loadProduct() {
  if (!id || !root) {
    root.innerHTML = '<p class="alert alert-error">Missing product id.</p>';
    return;
  }
  try {
    const m = await apiGet(`/api/medicines/${id}`);
    const brand = window.__OMS_LAYOUT?.settings?.brand_name || 'Online Medicine Store';
    document.title = `${m.name} | ${brand}`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', (m.description || m.name).slice(0, 160));

    root.innerHTML = `
      <div class="split-product">
        <div>
          <img class="product-hero-img" src="${m.image_url || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600&q=80'}" alt="${escapeHtml(m.name)}" width="600" height="450" />
        </div>
        <div>
          <p class="card-meta">${escapeHtml(m.category_name || '')} · Stock: ${m.stock}</p>
          <h1>${escapeHtml(m.name)}</h1>
          <p class="price" style="font-size:1.5rem">${formatBdt(m.price)}</p>
          ${m.expiry_date ? `<p class="field-hint">Expiry: ${m.expiry_date}</p>` : ''}
          <p>${escapeHtml(m.description || '')}</p>
          <div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:1rem;align-items:center">
            <label for="pqty" class="field-hint" style="margin:0">Qty</label>
            <input type="number" id="pqty" min="1" max="99" value="1" style="width:5rem" />
            <button type="button" class="btn btn-primary" id="btn-add">Add to cart</button>
            <a class="btn btn-outline" href="/cart">View cart</a>
          </div>
          <p style="margin-top:1rem"><button type="button" class="btn btn-accent" id="btn-whatsapp">Order on WhatsApp</button></p>
        </div>
      </div>`;

    document.getElementById('btn-add').addEventListener('click', () => {
      const qty = Math.max(1, Math.min(99, Number(document.getElementById('pqty').value) || 1));
      if (m.stock < qty) {
        alert('Not enough stock.');
        return;
      }
      CartStore.add(m, qty);
      alert('Added to cart');
    });

    const cfg = await getPublicConfig();
    document.getElementById('btn-whatsapp').addEventListener('click', () => {
      const qty = Math.max(1, Math.min(99, Number(document.getElementById('pqty').value) || 1));
      const items = [{ name: m.name, qty, price: Number(m.price) }];
      const text = whatsappOrderLink(items, items[0].price * items[0].qty);
      const num = (cfg.whatsappNumber || '').replace(/\D/g, '');
      if (!num) {
        alert('WhatsApp number not configured (WHATSAPP_NUMBER in .env).');
        return;
      }
      window.open(`https://wa.me/${num}?text=${text}`, '_blank');
    });
  } catch (e) {
    root.innerHTML = `<p class="alert alert-error">${escapeHtml(e.message)}</p>`;
  }
}

reviewForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(reviewForm);
  try {
    await apiPost('/api/reviews', {
      medicine_id: Number(id),
      user_name: fd.get('user_name'),
      rating: Number(fd.get('rating')),
      comment: fd.get('comment'),
    });
    reviewForm.reset();
    await initReviews();
    alert('Thank you for your review.');
  } catch (err) {
    alert(err.message);
  }
});

loadProduct().then(() => initReviews());
