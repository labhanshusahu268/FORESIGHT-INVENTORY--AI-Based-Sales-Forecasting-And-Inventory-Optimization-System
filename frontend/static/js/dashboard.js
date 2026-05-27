/* ForeSight — Dashboard JS */
let charts = {};

async function loadDashboard() {
  try {
    const data = await api('/api/dashboard/stats');
    renderStats(data.summary);
    renderMonthly(data.monthly);
    renderCategory(data.by_category);
    renderSeason(data.by_season);
    renderFestival(data.by_festival);
    renderTopProducts(data.top_products);
    renderLowStock(data.low_stock);
    renderCatBreakdown(data.by_category);
    // Greeting
    const hour = new Date().getHours();
    
    const el = document.getElementById('greeting');
    if (el) el.textContent = `${hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'}! Here's your inventory overview.`;
  } catch(e) {
    toast('Failed to load dashboard: ' + e.message, 'error');
  }
}

function renderStats(s) {
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set('s-revenue',  fINR(s.total_revenue));
  set('s-profit',   fINR(s.total_profit));
  set('s-margin',   fPct(s.avg_margin));
  set('s-units',    fNum(s.total_units));
  set('s-products', fNum(s.total_products));
  set('s-lowstock', s.low_stock_count || 0);
  if (s.low_stock_count > 0) {
    const badge = document.getElementById('low-stock-badge');
    const cnt   = document.getElementById('low-stock-cnt');
    if (badge) badge.style.display='inline-flex';
    if (cnt)   cnt.textContent = s.low_stock_count;
  }
  // Show/hide sample data banner
  const banner = document.getElementById('sample-banner');
  if (banner) {
    if (!s || s.total_products === 0) {
      banner.style.display = 'flex';
      banner.style.alignItems = 'center';
    } else {
      banner.style.display = 'none';
    }
  }
}

function renderMonthly(monthly) {
  const ctx = document.getElementById('chart-monthly');
  if (!ctx) return;
  if (charts.monthly) charts.monthly.destroy();
  if (!monthly?.length) { ctx.parentNode.innerHTML='<div class="empty-state" style="padding:40px"><div class="empty-state-icon">📈</div><p>Add inventory data to see trends</p></div>'; return; }
  const labels = monthly.map(m => MONTHS[m.month-1]+' '+m.year);
  charts.monthly = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Revenue', data:monthly.map(m=>m.revenue), backgroundColor:C.purpleA, borderColor:C.purple, borderWidth:2, borderRadius:6, order:2 },
        { label:'Profit',  data:monthly.map(m=>m.profit),  type:'line', borderColor:C.green, backgroundColor:C.greenA, borderWidth:2.5, tension:0.45, fill:true, pointBackgroundColor:C.green, pointRadius:4, order:1 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ position:'top' }, tooltip:{ callbacks:{ label:c=>`${c.dataset.label}: ${fINR(c.raw)}` } } },
      scales:{
        y:{ ticks:{ callback:v=>fINR(v) }, grid:{ color:'rgba(255,255,255,0.04)' } },
        x:{ grid:{ display:false } }
      }
    }
  });
}

function renderCategory(cats) {
  const ctx = document.getElementById('chart-category');
  if (!ctx) return;
  if (charts.category) charts.category.destroy();
  if (!cats?.length) { ctx.parentNode.innerHTML='<div class="empty-state" style="padding:40px"><div class="empty-state-icon">📦</div><p>No category data yet</p></div>'; return; }
  charts.category = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels: cats.map(c=>c.category),
      datasets:[{ data:cats.map(c=>c.revenue), backgroundColor:C.palette, borderWidth:2, borderColor:'#111420', hoverOffset:6 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'68%',
      plugins:{
        legend:{ position:'right', labels:{ font:{size:11}, padding:12 } },
        tooltip:{ callbacks:{ label:c=>`${c.label}: ${fINR(c.raw)} (${fPct(c.raw/cats.reduce((a,b)=>a+b.revenue,0)*100)})` } }
      }
    }
  });
}

function renderSeason(seasons) {
  const ctx = document.getElementById('chart-season');
  if (!ctx) return;
  if (charts.season) charts.season.destroy();
  if (!seasons?.length) { ctx.parentNode.innerHTML='<div class="empty-state" style="padding:40px"><div class="empty-state-icon">🌡️</div><p>No season data yet</p></div>'; return; }
  charts.season = new Chart(ctx, {
    type:'radar',
    data:{
      labels: seasons.map(s=>s.season),
      datasets:[
        { label:'Revenue', data:seasons.map(s=>s.revenue), backgroundColor:'rgba(108,99,255,0.15)', borderColor:C.purple, borderWidth:2, pointBackgroundColor:C.purple, pointRadius:5 },
        { label:'Profit',  data:seasons.map(s=>s.profit),  backgroundColor:'rgba(0,230,118,0.15)',   borderColor:C.green,  borderWidth:2, pointBackgroundColor:C.green,  pointRadius:5 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top' } },
      scales:{ r:{ grid:{ color:'rgba(255,255,255,0.06)' }, ticks:{ display:false }, pointLabels:{ font:{size:12}, color:'#9ba3c4' } } }
    }
  });
}

function renderFestival(festivals) {
  const ctx = document.getElementById('chart-festival');
  if (!ctx) return;
  if (charts.festival) charts.festival.destroy();
  if (!festivals?.length) { ctx.parentNode.innerHTML='<div class="empty-state" style="padding:40px"><div class="empty-state-icon">🎉</div><p>Add festival sales to see impact</p></div>'; return; }
  charts.festival = new Chart(ctx, {
    type:'bar',
    data:{
      labels: festivals.map(f=>f.festival),
      datasets:[
        { label:'Profit',  data:festivals.map(f=>f.profit),  backgroundColor:C.palette, borderRadius:8, borderWidth:0 },
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:c=>`Profit: ${fINR(c.raw)}` } } },
      scales:{ x:{ ticks:{ callback:v=>fINR(v) }, grid:{ color:'rgba(255,255,255,0.04)' } }, y:{ grid:{ display:false } } }
    }
  });
}

function renderTopProducts(products) {
  const tbody = document.getElementById('tbl-top-products');
  if (!tbody) return;
  if (!products?.length) {
    tbody.innerHTML=`<tr><td colspan="7"><div class="empty-state" style="padding:32px">
      <div class="empty-state-icon">📦</div>
      <div class="empty-state-title">No products yet</div>
      <a href="/inventory" class="btn btn-primary btn-sm" style="margin-top:12px">+ Add Products</a>
    </div></td></tr>`; return;
  }
  tbody.innerHTML = products.map((p,i) => {
    const margin = parseFloat(p.margin||0);
    const mc = margin>30?'green':margin>15?'yellow':'red';
    return `<tr>
      <td><span style="font-weight:800;color:var(--text3);font-family:'Outfit',sans-serif">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span></td>
      <td><span style="font-weight:600">${p.product_name}</span></td>
      <td><span class="badge badge-purple">${p.category}</span></td>
      <td class="num">${fNum(p.units)}</td>
      <td class="num" style="color:var(--accent)">${fINR(p.revenue)}</td>
      <td class="num" style="color:var(--success);font-weight:700">${fINR(p.profit)}</td>
      <td><span class="badge badge-${mc}">${fPct(margin)}</span></td>
    </tr>`;
  }).join('');
}

function renderLowStock(items) {
  const el = document.getElementById('low-stock-list');
  if (!el) return;
  if (!items?.length) { el.innerHTML='<div class="alert alert-success" style="margin:0">✅ All products well-stocked!</div>'; return; }
  el.innerHTML = items.map(item => {
    const pct = Math.min(100, (item.current_stock / Math.max(item.reorder_level,1)) * 100);
    const col = pct<30?'red':pct<70?'yellow':'green';
    return `<div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <div class="flex justify-between items-center mb1">
        <span style="font-size:13px;font-weight:600">${item.product_name}</span>
        <span style="font-size:12px;color:var(--danger);font-weight:700">${item.current_stock} left</span>
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px">Reorder at: ${item.reorder_level} | Lead: ${item.lead_time_days}d</div>
      <div class="progress"><div class="progress-bar ${col}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function renderCatBreakdown(cats) {
  const el = document.getElementById('cat-breakdown');
  if (!el || !cats?.length) return;
  const maxRev = Math.max(...cats.map(c=>c.revenue), 1);
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:14px;margin-top:8px">
    ${cats.map(c => {
      const pct = (c.revenue/maxRev*100).toFixed(0);
      const margin = parseFloat(c.avg_margin||0);
      const mc = margin>30?'green':margin>15?'yellow':'red';
      return `<div>
        <div class="flex justify-between items-center" style="margin-bottom:6px">
          <div class="flex items-center gap-3">
            <span style="font-weight:600;font-size:14px">${c.category}</span>
            <span class="badge badge-${mc}">${fPct(margin)} margin</span>
            <span class="text-muted text-xs">${c.product_count} products</span>
          </div>
          <div class="flex gap-3 text-sm">
            <span style="color:var(--accent)">${fINR(c.revenue)}</span>
            <span style="color:var(--success)">${fINR(c.profit)}</span>
          </div>
        </div>
        <div class="progress"><div class="progress-bar purple" style="width:${pct}%"></div></div>
      </div>`;
    }).join('')}
  </div>`;
}

function scrollSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' });
}

document.addEventListener('DOMContentLoaded', loadDashboard);

/* ── Sample Data Loader ─────────────────────── */
async function loadSampleData() {
  const btn = event.target;
  btn.disabled = true; btn.textContent = '⏳ Loading...';
  try {
    const { message, added } = await api('/api/inventory/load-sample-data', 'POST');
    toast(message, 'success', 4000);
    document.getElementById('sample-banner').style.display = 'none';
    setTimeout(() => loadDashboard(), 800);
  } catch(e) {
    toast(e.message, 'error');
    btn.disabled = false; btn.textContent = '📦 Load Sample Data';
  }
}

