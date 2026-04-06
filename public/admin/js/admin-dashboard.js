/**
 * KPI + finance from DB only — loading, empty state, no placeholder revenue.
 */
import { adminFetch, requireAdminSession } from './admin-api.js';
import { renderAdminNav, bindLogout } from './admin-nav.js';

let revenueChart = null;

function skeletonStats(n) {
  const cell = `<div class="stat skeleton-stat"><span class="skeleton-line"></span><span class="skeleton-line short"></span></div>`;
  return cell.repeat(n);
}

function fmtMoney(v) {
  if (v == null || Number.isNaN(Number(v))) return 'N/A';
  return `৳ ${Number(v).toFixed(2)}`;
}

function fmtCount(v) {
  if (v == null || Number.isNaN(Number(v))) return 'N/A';
  return String(v);
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

if (!requireAdminSession()) {
  /* redirect */
} else {
  document.getElementById('nav-ph').outerHTML = renderAdminNav('dashboard');
  bindLogout();

  const statsEl = document.getElementById('stats');
  const financeEl = document.getElementById('finance');
  const payTbody = document.getElementById('pay-tbody');
  const catTbody = document.getElementById('cat-tbody');
  const chartWrap = document.getElementById('chart-wrap');
  const financeEmptyEl = document.getElementById('finance-empty');

  statsEl.innerHTML = skeletonStats(4);
  financeEl.innerHTML = skeletonStats(7);
  payTbody.innerHTML = '';
  catTbody.innerHTML = '<tr><td colspan="2" class="skeleton-stat">…</td></tr>';
  if (financeEmptyEl) financeEmptyEl.hidden = true;
  if (chartWrap) chartWrap.hidden = true;

  Promise.all([adminFetch('/api/admin/dashboard'), adminFetch('/api/admin/dashboard/finance')])
    .then(([dash, fin]) => {
      const hasTx = fin.meta?.has_transactions === true;

      statsEl.innerHTML = `
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Total orders</span><strong>${fmtCount(dash.total_orders)}</strong></div>
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Sales (BDT)</span><strong>${fmtMoney(dash.total_sales_bdt)}</strong></div>
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Customers</span><strong>${fmtCount(dash.total_customers)}</strong></div>
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Rx pending</span><strong>${fmtCount(dash.pending_prescriptions)}</strong></div>`;

      if (!hasTx) {
        if (financeEmptyEl) {
          financeEmptyEl.hidden = false;
          financeEmptyEl.innerHTML =
            '<p class="finance-empty-msg">No transactions available yet.</p><p class="finance-empty-hint">Revenue and payment breakdown will appear here once orders exist.</p>';
        }
        financeEl.innerHTML = `
          <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Today</span><strong>N/A</strong></div>
          <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">7 days</span><strong>N/A</strong></div>
          <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">30 days</span><strong>N/A</strong></div>
          <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">All-time revenue</span><strong>N/A</strong></div>
          <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Completed</span><strong>N/A</strong></div>
          <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Cancelled</span><strong>N/A</strong></div>
          <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Open</span><strong>N/A</strong></div>`;
        payTbody.innerHTML =
          '<tr><td colspan="3" class="empty-table-msg">No transactions available yet.</td></tr>';
      } else {
        if (financeEmptyEl) financeEmptyEl.hidden = true;
        const f = fin.income;
        const o = fin.orders;
        financeEl.innerHTML = `
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Today</span><strong>${fmtMoney(f.daily)}</strong></div>
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">7 days</span><strong>${fmtMoney(f.weekly)}</strong></div>
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">30 days</span><strong>${fmtMoney(f.monthly)}</strong></div>
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">All-time revenue</span><strong>${fmtMoney(f.total)}</strong></div>
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Completed</span><strong>${fmtCount(o.completed)}</strong></div>
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Cancelled</span><strong>${fmtCount(o.cancelled)}</strong></div>
        <div class="stat"><span style="color:var(--a-muted);font-size:0.8rem">Open</span><strong>${fmtCount(o.open)}</strong></div>`;

        const payRows = fin.payment_breakdown || [];
        payTbody.innerHTML = payRows.length
          ? payRows
              .map(
                (p) =>
                  `<tr><td>${escape(p.payment_method)}</td><td>${fmtCount(p.cnt)}</td><td>${fmtMoney(p.revenue)}</td></tr>`
              )
              .join('')
          : '<tr><td colspan="3" class="empty-table-msg">No payment split data.</td></tr>';
      }

      const ls = fin.low_stock_alert;
      if (ls.items?.length) {
        document.getElementById('low-banner').innerHTML = `
          <div class="alert alert-warn-admin" style="margin-bottom:1rem">
            <strong>Low stock (${ls.threshold})</strong>: ${ls.items.length} SKU(s) below threshold — check Stock page.
          </div>`;
      }

      catTbody.innerHTML = (fin.categories || [])
        .map((c) => `<tr><td>${escape(c.name)}</td><td>${fmtCount(c.products)}</td></tr>`)
        .join('') || '<tr><td colspan="2" class="empty-table-msg">No categories.</td></tr>';

      if (revenueChart) {
        revenueChart.destroy();
        revenueChart = null;
      }

      const labels = (fin.chart_last7_days || []).map((r) => String(r.d).slice(5));
      const data = (fin.chart_last7_days || []).map((r) => Number(r.revenue));
      const ctx = document.getElementById('rev-chart');

      if (hasTx && typeof Chart !== 'undefined' && ctx && labels.length) {
        if (chartWrap) chartWrap.hidden = false;
        revenueChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'BDT',
                data,
                backgroundColor: 'rgba(130, 209, 193, 0.55)',
                borderColor: 'rgba(130, 209, 193, 0.9)',
                borderWidth: 1,
                borderRadius: 8,
                hoverBackgroundColor: 'rgba(130, 209, 193, 0.75)',
              },
            ],
          },
          options: {
            animation: { duration: 450, easing: 'easeOutQuart' },
            plugins: {
              legend: { labels: { color: '#bbbbbb', font: { family: "'Outfit', sans-serif" } } },
            },
            scales: {
              x: {
                ticks: { color: '#bbbbbb' },
                grid: { color: 'rgba(130, 209, 193, 0.06)' },
              },
              y: {
                beginAtZero: true,
                ticks: { color: '#bbbbbb' },
                grid: { color: 'rgba(130, 209, 193, 0.08)' },
              },
            },
          },
        });
      } else if (chartWrap) {
        chartWrap.hidden = true;
      }
    })
    .catch((e) => {
      statsEl.innerHTML = `<div class="alert alert-error">${escape(e.message)}</div>`;
      financeEl.innerHTML = '';
    });
}
