/* ForeSight — Reports JS */
let rCharts = {};

async function loadReports() {
  try {
    const data = await api('/api/dashboard/stats');
    const s = data.summary;
    // Stats
    document.getElementById('r-revenue').textContent    = fINR(s.total_revenue);
    document.getElementById('r-profit').textContent     = fINR(s.total_profit);
    document.getElementById('r-margin').textContent     = fPct(s.avg_margin);
    document.getElementById('r-investment').textContent = fINR(s.total_investment);

    renderTrendChart(data.monthly);
    renderCatChart(data.by_category);
    renderSeasonChart(data.by_season);
    renderFestivalChart(data.by_festival);
    renderProductsTable(data.top_products);

    // Category trends
    const catData = await api('/api/dashboard/category-trends');
    renderCatTrendChart(catData.data);
  } catch(e) {
    toast('Failed to load reports: ' + e.message, 'error');
  }
}

function renderTrendChart(monthly) {
  const ctx = document.getElementById('r-trend-chart');
  if (!ctx || !monthly?.length) return;
  if (rCharts.trend) rCharts.trend.destroy();
  const labels = monthly.map(m => MONTHS[m.month - 1] + ' ' + m.year);
  rCharts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Revenue', data: monthly.map(m => m.revenue), borderColor: C.purple, backgroundColor: C.purpleA, borderWidth: 2.5, tension: 0.45, fill: true, pointRadius: 4, pointBackgroundColor: C.purple },
        { label: 'Profit',  data: monthly.map(m => m.profit),  borderColor: C.green,  backgroundColor: C.greenA,  borderWidth: 2.5, tension: 0.45, fill: true, pointRadius: 4, pointBackgroundColor: C.green },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fINR(c.raw)}` } } },
      scales: {
        y: { ticks: { callback: v => fINR(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderCatChart(cats) {
  const ctx = document.getElementById('r-cat-chart');
  if (!ctx || !cats?.length) return;
  if (rCharts.cat) rCharts.cat.destroy();
  rCharts.cat = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c.category),
      datasets: [{ data: cats.map(c => c.revenue), backgroundColor: C.palette, borderWidth: 2, borderColor: '#111420', hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, padding: 14 } },
        tooltip: { callbacks: { label: c => `${c.label}: ${fINR(c.raw)}` } }
      }
    }
  });
}

function renderSeasonChart(seasons) {
  const ctx = document.getElementById('r-season-chart');
  if (!ctx || !seasons?.length) return;
  if (rCharts.season) rCharts.season.destroy();
  rCharts.season = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: seasons.map(s => s.season),
      datasets: [
        { label: 'Revenue', data: seasons.map(s => s.revenue), backgroundColor: C.purpleA, borderColor: C.purple, borderWidth: 2, borderRadius: 8 },
        { label: 'Profit',  data: seasons.map(s => s.profit),  backgroundColor: C.greenA,  borderColor: C.green,  borderWidth: 2, borderRadius: 8 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fINR(c.raw)}` } } },
      scales: {
        y: { ticks: { callback: v => fINR(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderFestivalChart(festivals) {
  const ctx = document.getElementById('r-festival-chart');
  if (!ctx || !festivals?.length) return;
  if (rCharts.festival) rCharts.festival.destroy();
  rCharts.festival = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: festivals.map(f => f.festival),
      datasets: [
        { label: 'Units',  data: festivals.map(f => f.units),  backgroundColor: C.cyanA,   borderColor: C.cyan,  borderWidth: 2, borderRadius: 6, yAxisID: 'y1' },
        { label: 'Profit', data: festivals.map(f => f.profit), backgroundColor: C.yellowA, borderColor: C.yellow, borderWidth: 2, borderRadius: 6 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => c.dataset.label === 'Profit' ? `Profit: ${fINR(c.raw)}` : `Units: ${fNum(c.raw)}` } } },
      scales: {
        y:  { ticks: { callback: v => fINR(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y1: { position: 'right', ticks: { callback: v => fNum(v) }, grid: { drawOnChartArea: false } },
        x:  { grid: { display: false } }
      }
    }
  });
}

function renderCatTrendChart(data) {
  const ctx = document.getElementById('r-cattrend-chart');
  if (!ctx || !data?.length) return;
  if (rCharts.cattrend) rCharts.cattrend.destroy();

  // Group by category, then by month
  const cats = [...new Set(data.map(d => d.category))];
  const months = [...new Set(data.map(d => MONTHS[d.month - 1] + ' ' + d.year))];

  const datasets = cats.map((cat, i) => {
    const catData = months.map(label => {
      const [mStr, yr] = label.split(' ');
      const mIdx = MONTHS.indexOf(mStr) + 1;
      const row = data.find(d => d.category === cat && d.month === mIdx && d.year === parseInt(yr));
      return row ? row.profit : 0;
    });
    return {
      label: cat,
      data: catData,
      borderColor: C.palette[i % C.palette.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: C.palette[i % C.palette.length],
    };
  });

  rCharts.cattrend = new Chart(ctx, {
    type: 'line',
    data: { labels: months, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fINR(c.raw)}` } } },
      scales: {
        y: { ticks: { callback: v => fINR(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderProductsTable(products) {
  const tbody = document.getElementById('r-products-tbl');
  if (!products?.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state" style="padding:32px"><div class="empty-state-icon">📦</div><div class="empty-state-title">No data yet</div></div></td></tr>';
    return;
  }
  tbody.innerHTML = products.map((p, i) => {
    const margin = parseFloat(p.margin || 0);
    const mc = margin > 30 ? 'green' : margin > 15 ? 'yellow' : 'red';
    return `<tr>
      <td><span style="font-weight:700;color:var(--text3)">${i + 1}</span></td>
      <td style="font-weight:600">${p.product_name}</td>
      <td><span class="badge badge-purple">${p.category}</span></td>
      <td class="num">${fNum(p.units)}</td>
      <td class="num" style="color:var(--accent)">${fINR(p.revenue)}</td>
      <td class="num" style="color:var(--success);font-weight:700">${fINR(p.profit)}</td>
      <td><span class="badge badge-${mc}">${fPct(margin)}</span></td>
      <td><span class="badge badge-blue">${p.season || '—'}</span></td>
    </tr>`;
  }).join('');
}

async function exportPDF() {
  const btn = document.getElementById('pdf-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
  toast('Generating PDF report...', 'info');
  try {
    const res = await fetch('/api/reports/export-pdf', { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'PDF generation failed');
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `foresight_report_${new Date().toISOString().split('T')[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ PDF downloaded!', 'success');
  } catch(e) {
    toast('PDF error: ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Download PDF'; }
}

async function exportCSV() {
  toast('Preparing CSV export...', 'info');
  try {
    const res = await fetch('/api/reports/export-csv', { credentials: 'include' });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ CSV downloaded!', 'success');
  } catch(e) {
    toast('CSV error: ' + e.message, 'error');
  }
}

async function loadInsights() {
  const panel = document.getElementById('insights-panel');
  panel.style.display = 'block';
  panel.innerHTML = '<div class="card"><div class="loading"><div class="spinner"></div> Generating AI insights...</div></div>';
  try {
    const data = await api('/api/dashboard/stats');
    const s = data.summary;
    const topCat  = data.by_category?.[0];
    const topFest = data.by_festival?.[0];
    const topSeas = data.by_season?.[0];
    const lowStock = s.low_stock_count || 0;

    const roi = s.total_investment > 0 ? ((s.total_profit / s.total_investment) * 100).toFixed(1) : 0;

    const insights = [
      { icon: '💰', title: 'Profitability', text: `Your overall ROI is <strong>${roi}%</strong>. ${parseFloat(roi) > 20 ? '✅ Excellent margins! You\'re beating most retailers.' : parseFloat(roi) > 10 ? '📊 Good margins, with room to optimise.' : '⚠️ Consider reviewing pricing or reducing costs.'}`, color: 'purple' },
      topCat ? { icon: '🏆', title: 'Top Category', text: `<strong>${topCat.category}</strong> is your best performing category with <strong>${fINR(topCat.revenue)}</strong> revenue and <strong>${fPct(topCat.avg_margin)}</strong> average margin. Focus here for maximum returns.`, color: 'green' } : null,
      topFest ? { icon: '🎉', title: 'Festival Opportunity', text: `<strong>${topFest.festival}</strong> is your highest-impact festival with <strong>${fINR(topFest.profit)}</strong> profit. Plan inventory 2-3 weeks before to capture full demand.`, color: 'yellow' } : null,
      topSeas ? { icon: '🌡️', title: 'Seasonal Strength', text: `<strong>${topSeas.season}</strong> is your strongest season. Pre-stock inventory at start of the season to avoid stockouts during peak demand.`, color: 'blue' } : null,
      lowStock > 0 ? { icon: '🚨', title: 'Stock Alert', text: `<strong>${lowStock} products</strong> are below reorder level. Immediate restocking needed to prevent revenue loss and customer disappointment.`, color: 'red' } : { icon: '✅', title: 'Stock Health', text: 'All products are above reorder levels. Your inventory health is good.', color: 'green' },
      { icon: '🔮', title: 'AI Recommendation', text: 'Use the <strong>Budget Planner</strong> in the AI Predict section to optimally allocate your next purchase budget for maximum ROI across all categories.', color: 'purple' },
    ].filter(Boolean);

    panel.innerHTML = `<div class="card mb2">
      <div class="card-title">🤖 AI Business Insights</div>
      <div class="card-sub">Auto-generated analysis of your inventory patterns</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:4px">
        ${insights.map(ins => `
          <div style="background:var(--surface2);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;border-left:3px solid ${ins.color === 'purple' ? 'var(--accent)' : ins.color === 'green' ? 'var(--success)' : ins.color === 'yellow' ? 'var(--accent4)' : ins.color === 'blue' ? 'var(--accent3)' : 'var(--danger)'}">
            <div style="font-weight:700;margin-bottom:6px;font-size:14px">${ins.icon} ${ins.title}</div>
            <div style="font-size:13px;color:var(--text2);line-height:1.6">${ins.text}</div>
          </div>`).join('')}
      </div>
    </div>`;
    toast('Insights generated!', 'success');
  } catch(e) {
    panel.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', loadReports);
