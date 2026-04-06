/**
 * Prescription image upload — multipart to /api/prescriptions.
 */
import { apiPost } from './api.js';

const form = document.getElementById('rx-form');
const msg = document.getElementById('rx-msg');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.innerHTML = '';
  const fd = new FormData(form);
  const file = fd.get('prescription');
  if (!file || !file.size) {
    msg.innerHTML = `<div class="alert alert-error">Please choose an image file.</div>`;
    return;
  }
  try {
    await apiPost('/api/prescriptions', fd, true);
    form.reset();
    msg.innerHTML = `<div class="alert alert-success">Upload received. Our team will verify your prescription.</div>`;
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
});
