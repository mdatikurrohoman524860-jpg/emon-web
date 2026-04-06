/**
 * Admin sidebar — CMS + catalog + operations.
 */
export function renderAdminNav(active) {
  const links = [
    { href: '/admin/dashboard', id: 'dashboard', label: 'Dashboard' },
    { href: '/admin/appearance', id: 'appearance', label: 'Appearance' },
    { href: '/admin/navigation', id: 'navigation', label: 'Navigation' },
    { href: '/admin/footer', id: 'footer', label: 'Footer' },
    { href: '/admin/slides', id: 'slides', label: 'Hero slides' },
    { href: '/admin/categories', id: 'categories', label: 'Categories' },
    { href: '/admin/coupons', id: 'coupons', label: 'Coupons' },
    { href: '/admin/medicines', id: 'medicines', label: 'Medicines' },
    { href: '/admin/orders', id: 'orders', label: 'Orders' },
    { href: '/admin/prescriptions', id: 'prescriptions', label: 'Prescriptions' },
    { href: '/admin/stock', id: 'stock', label: 'Stock & expiry' },
    { href: '/admin/users', id: 'users', label: 'Users' },
    { href: '/admin/messages', id: 'messages', label: 'Contact msgs' },
  ];
  return `
    <aside class="admin-side">
      <div class="admin-brand">OMS Admin</div>
      <nav>
        ${links
          .map(
            (l) =>
              `<a href="${l.href}" class="${l.id === active ? 'active' : ''}">${l.label}</a>`
          )
          .join('')}
        <a href="#" id="admin-logout">Logout</a>
      </nav>
    </aside>`;
}

export function bindLogout() {
  document.getElementById('admin-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('oms_admin_token');
    window.location.href = '/admin/login';
  });
}
