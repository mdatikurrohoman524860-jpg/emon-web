/**
 * Login / Register tabs — stores oms_token for optional checkout linking.
 */
import { apiPost } from './api.js';

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const msg = document.getElementById('auth-msg');

document.querySelectorAll('[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.auth-panel').forEach((p) => {
      p.hidden = p.dataset.panel !== tab;
    });
    document.querySelectorAll('[data-tab]').forEach((b) => {
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
  });
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.innerHTML = '';
  const fd = new FormData(loginForm);
  try {
    const data = await apiPost('/api/auth/login', {
      email: fd.get('email'),
      password: fd.get('password'),
    });
    localStorage.setItem('oms_token', data.token);
    msg.innerHTML = `<div class="alert alert-success">Welcome, ${data.user.name}. <a href="/my-orders">My orders</a> · <a href="/shop">Shop</a></div>`;
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
});

registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.innerHTML = '';
  const fd = new FormData(registerForm);
  try {
    const data = await apiPost('/api/auth/register', {
      name: fd.get('name'),
      email: fd.get('email'),
      password: fd.get('password'),
      phone: fd.get('phone') || undefined,
    });
    localStorage.setItem('oms_token', data.token);
    msg.innerHTML = `<div class="alert alert-success">Account created. <a href="/my-orders">My orders</a> · <a href="/shop">Shop</a></div>`;
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
});
