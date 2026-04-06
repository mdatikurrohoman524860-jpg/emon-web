/**
 * Contact form POST /api/contact.
 */
import { apiPost } from './api.js';

const form = document.getElementById('contact-form');
const msg = document.getElementById('contact-msg');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.innerHTML = '';
  const fd = new FormData(form);
  try {
    await apiPost('/api/contact', {
      name: fd.get('name'),
      email: fd.get('email'),
      phone: fd.get('phone') || undefined,
      message: fd.get('message'),
    });
    form.reset();
    msg.innerHTML = `<div class="alert alert-success">Message sent. We will reply soon.</div>`;
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
});
