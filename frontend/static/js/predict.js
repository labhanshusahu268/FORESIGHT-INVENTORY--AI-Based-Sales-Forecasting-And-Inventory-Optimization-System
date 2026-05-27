/* ForeSight — Predict JS (complete rewrite with sliders) */
let budgetChart = null;

/* ── Slider helpers ─────────────────────────────── */
function updateSlider(inputId, displayId, suffix) {
  const el = document.getElementById(inputId);
  const disp = document.getElementById(displayId);
  if (!el || !disp) return;
  const val = parseFloat(el.value);
  disp.textContent = suffix === '' ? val.toFixed(2) : val + suffix;
  // Update gradient fill
  const pct = ((val - el.min) / (el.max - el.min)) * 100;
  el.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--surface3) ${pct}%, var(--surface3) 100%)`;
}

function updateSuppLabel() {
  const val = parseFloat(document.getElementById('p-supp').value);
  const pct = Math.round(val * 100);
  const el = document.getElementById('supp-label');
  if (!el) return;
  if (pct >= 90)      el.innerHTML = `🟢 ${pct}% reliable — Excellent supplier`;
  else if (pct >= 75) el.innerHTML = `🟡 ${pct}% reliable — Average supplier`;
  else                el.innerHTML = `🔴 ${pct}% reliable — Risky supplier`;
  el.style.color = pct >= 90 ? 'var(--success)' : pct >= 75 ? 'var(--warning)' : 'var(--danger)';
}

function updatePriceCalc() {
  const cost = parseFloat(document.getElementById('p-cost').value) || 0;
  const sell = parseFloat(document.getElementById('p-sell').value) || 0;
  const disc = parseFloat(document.getElementById('p-disc')?.value) || 0;
  const prev = document.getElementById('p-margin-preview');
  if (!prev) return;
  if (cost > 0 && sell > 0) {
    prev.style.display = 'block';
    const eff = sell * (1 - disc / 100);
    const margin = ((sell - cost) / cost * 100).toFixed(1);
    const profitPer = (eff - cost).toFixed(0);
    document.getElementById('p-prev-margin').textContent = profitPer >= 0 ? `₹${profitPer}` : `-₹${Math.abs(profitPer)}`;
    document.getElementById('p-prev-margin').style.color = profitPer >= 0 ? 'var(--accent)' : 'var(--danger)';
    document.getElementById('p-prev-pct').textContent = margin + '%';
    document.getElementById('p-prev-pct').style.color = margin >= 15 ? 'var(--success)' : margin >= 5 ? 'var(--warning)' : 'var(--danger)';
  } else {
    prev.style.display = 'none';
  }
}

/* ── Tab switching ─────────────────────────────── */
function showTab(tab) {
  ['analyze','budget','history'].forEach(t => {
    document.getElementById(`pane-${t}`).style.display = t === tab ? 'block' : 'none';
    const btn = document.getElementById(`tab-${t}`);
    if (btn) btn.className = t === tab ? 'btn btn-primary' : 'btn btn-secondary';
  });
  if (tab === 'history') loadHistory();
}

/* ── Build payload from form ───────────────────── */
function getPayload() {
  return {
    product_name:         document.getElementById('p-name').value.trim() || 'Unknown Product',
    category:             document.getElementById('p-cat').value,
    season:               document.getElementById('p-season').value,
    festival:             document.getElementById('p-festival').value,
    month:                parseInt(document.getElementById('p-month').value),
    year:                 new Date().getFullYear(),
    cost_price:           parseFloat(document.getElementById('p-cost').value) || 100,
    selling_price:        parseFloat(document.getElementById('p-sell').value) || 150,
    current_stock:        parseInt(document.getElementById('p-stock').value) || 50,
    reorder_level:        parseInt(document.getElementById('p-reorder').value) || 10,
    lead_time_days:       parseInt(document.getElementById('p-lead').value) || 3,
    supplier_reliability: parseFloat(document.getElementById('p-supp').value),   // slider = always valid 0-1
    discount_pct:         parseFloat(document.getElementById('p-disc').value) || 0,
    day_of_week:          new Date().getDay(),
    day:                  new Date().getDate(),
    week:                 Math.ceil(new Date().getDate() / 7),
  };
}

/* ── Run Analysis ─────────────────────────────── */
async function runAnalysis() {
  const btn = document.getElementById('analyze-btn');
  btn.disabled = true; btn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px"><div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Running AI...</span>';
  const pane = document.getElementById('result-pane');
  pane.innerHTML = `<div class="card" style="min-height:300px"><div class="loading" style="min-height:280px"><div class="spinner"></div><span>Running ML models...</span></div></div>`;

  try {
    const payload = getPayload();
    const { result } = await api('/api/predict/analyze', 'POST', payload);
    renderResult(result);
  } catch (e) {
    pane.innerHTML = `<div class="card"><div class="alert alert-error">❌ ${e.message}</div></div>`;
  }
  btn.disabled = false; btn.textContent = '🔮 Run AI Analysis';
}

/* ── Render Result ────────────────────────────── */
function renderResult(r) {
  const pane = document.getElementById('result-pane');
  const demandColor = { High: 'var(--success)', Medium: 'var(--accent4)', Low: 'var(--danger)' };
  const dc = demandColor[r.demand_level] || 'var(--text)';

  pane.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- HERO -->
      <div class="hero-card">
        ${r.is_unknown ? '<div class="badge badge-yellow mb2">⚠️ Unknown product — category estimate used</div>' : ''}
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Predicted Monthly Sales</div>
          <div style="font-family:'Outfit',sans-serif;font-size:72px;font-weight:900;line-height:1;color:var(--accent)">${r.predicted_units}</div>
          <div style="font-size:14px;color:var(--text3);margin-top:6px">units expected this month</div>
          <div style="margin-top:14px">
            <span style="font-family:'Outfit',sans-serif;font-size:22px;font-weight:800;color:${dc}">${r.demand_icon} ${r.demand_level} Demand</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:8px">
          ${Object.entries(r.demand_proba || {}).map(([level, pct]) => {
            const lc = { High: 'green', Medium: 'yellow', Low: 'red' }[level];
            return `<div style="text-align:center">
              <div style="font-size:11px;color:var(--text3);margin-bottom:5px">${level}</div>
              <div class="progress"><div class="progress-bar ${lc}" style="width:${pct}%"></div></div>
              <div style="font-size:11px;color:var(--text2);margin-top:3px;font-weight:600">${pct}%</div>
            </div>`;
          }).join('')}
        </div>
        ${confidenceBar(r.confidence)}
      </div>

      <!-- METRICS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="result-box">
          <div class="result-row"><span class="result-label"> Expected Revenue</span><span class="result-val accent">${fINR(r.predicted_revenue)}</span></div>
          <div class="result-row"><span class="result-label"> Expected Profit</span><span class="result-val big">${fINR(r.predicted_profit)}</span></div>
          <div class="result-row"><span class="result-label"> Margin</span><span class="result-val">${fPct(r.margin_pct)}</span></div>
          <div class="result-row"><span class="result-label"> ROI</span><span class="result-val" style="color:var(--success)">${r.roi_pct}%</span></div>
        </div>
        <div class="result-box">
          <div class="result-row"><span class="result-label"> Reorder Qty</span><span class="result-val warn">${r.reorder_qty} units</span></div>
          <div class="result-row"><span class="result-label"> Investment Needed</span><span class="result-val">${fINR(r.investment_needed)}</span></div>
          <div class="result-row"><span class="result-label"> Days of Stock</span><span class="result-val">${r.days_of_stock} days</span></div>
          <div class="result-row"><span class="result-label"> Safety Stock</span><span class="result-val">${r.safety_stock} units</span></div>
        </div>
      </div>

      <!-- RISK -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="alert ${r.stockout_risk.includes('HIGH') ? 'alert-error' : r.stockout_risk.includes('MEDIUM') ? 'alert-warning' : 'alert-success'}" style="margin:0">
          <strong>Stockout Risk:</strong> ${r.stockout_risk}
        </div>
        <div class="alert ${r.overstock_risk.includes('YES') ? 'alert-warning' : 'alert-success'}" style="margin:0">
          <strong>Overstock Risk:</strong> ${r.overstock_risk}
        </div>
      </div>

      <div class="alert alert-info" style="margin:0">
        <strong> AI Recommendation:</strong> ${r.reorder_msg}
      </div>

      <div class="text-xs text-muted" style="text-align:right;padding:0 4px">${r.note} | ${r.model_used}</div>
    </div>
  `;
}

/* ── Budget Planner ───────────────────────────── */
async function runBudget() {
  const budget = parseFloat(document.getElementById('b-budget').value) || 0;
  if (budget <= 0) { toast('Bhai budget toh enter karo!', 'error'); return; }
  const btn = document.getElementById('budget-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></div> Analyzing...';
  const resultEl = document.getElementById('budget-result');
  resultEl.innerHTML = '<div class="card"><div class="loading"><div class="spinner"></div>Budget optimize kar raha hoon...</div></div>';
  try {
    const { result } = await api('/api/predict/budget', 'POST', {
      budget,
      season:   document.getElementById('b-season').value,
      festival: document.getElementById('b-festival').value,
      month:    new Date().getMonth() + 1,
    });
    renderBudget(result, budget);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
  btn.disabled = false; btn.textContent = ' Generate Budget Plan';
}

function renderBudget(r, budget) {
  const resultEl = document.getElementById('budget-result');
  if (!r.products?.length) {
    resultEl.innerHTML = '<div class="alert alert-warning">⚠️ No products found. <a href="/inventory" style="color:var(--accent)">Pehle inventory add karo.</a></div>';
    return;
  }
  const util = (r.allocated / budget * 100).toFixed(1);
  resultEl.innerHTML = `
    <div class="card mb3">
      <div class="card-title"> Budget Allocation Plan</div>
      <div class="card-sub">ROI ke hisaab se ranked — sabse zyada return wale products pehle</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:16px 0 20px;text-align:center">
        <div><div style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;color:var(--accent)">${fINR(r.total_budget)}</div><div class="text-xs text-muted mt1">Total Budget</div></div>
        <div><div style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;color:var(--warning)">${fINR(r.allocated)}</div><div class="text-xs text-muted mt1">Allocated (${util}%)</div></div>
        <div><div style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;color:var(--success)">${fINR(r.total_expected_profit)}</div><div class="text-xs text-muted mt1">Expected Profit</div></div>
        <div><div style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;color:var(--accent2)">${r.overall_roi}%</div><div class="text-xs text-muted mt1">Overall ROI</div></div>
      </div>
      <div class="progress mb3" style="height:8px"><div class="progress-bar purple" style="width:${util}%"></div></div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Rank</th><th>Product</th><th>Category</th><th class="num">Qty</th><th class="num">Cost</th><th class="num">Profit</th><th>ROI</th></tr></thead>
          <tbody>${r.products.map((p, i) => `
            <tr>
              <td><span style="font-weight:800;color:${i===0?'var(--accent4)':i===1?'#9ca3af':i===2?'#b45309':'var(--text3)'}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</span></td>
              <td style="font-weight:600">${p.product_name}</td>
              <td><span class="badge badge-purple">${p.category}</span></td>
              <td class="num" style="color:var(--accent);font-weight:700">${p.allocated_qty}</td>
              <td class="num" style="color:var(--warning)">${fINR(p.allocated_cost)}</td>
              <td class="num" style="color:var(--success);font-weight:700">${fINR(p.allocated_profit)}</td>
              <td><span class="badge ${p.roi_pct>20?'badge-green':p.roi_pct>10?'badge-yellow':'badge-red'}">${(p.roi_pct||0).toFixed(1)}%</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${r.remaining > 0 ? `<div class="alert alert-info mt2">💡 Bacha hua budget: <strong>${fINR(r.remaining)}</strong></div>` : ''}
    </div>
    <div class="card"><div class="card-title"> Cost vs Expected Profit</div><div class="chart-wrap" style="height:260px"><canvas id="budget-chart"></canvas></div></div>`;

  setTimeout(() => {
    const ctx = document.getElementById('budget-chart');
    if (!ctx) return;
    if (budgetChart) budgetChart.destroy();
    budgetChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: r.products.map(p => p.product_name.substring(0, 14)),
        datasets: [
          { label: 'Cost', data: r.products.map(p => p.allocated_cost), backgroundColor: C.pinkA, borderColor: C.pink, borderWidth: 2, borderRadius: 6 },
          { label: 'Profit', data: r.products.map(p => p.allocated_profit), backgroundColor: C.greenA, borderColor: C.green, borderWidth: 2, borderRadius: 6 },
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fINR(c.raw)}` } } }, scales: { y: { ticks: { callback: v => fINR(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { grid: { display: false } } } }
    });
  }, 100);
}

/* ── Prediction History ───────────────────────── */
async function loadHistory() {
  const el = document.getElementById('history-list');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
  try {
    const { history } = await api('/api/predict/history');
    if (!history?.length) {
      el.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-state-icon">📜</div><div class="empty-state-title">Abhi tak koi prediction nahi</div><div class="empty-state-text">Full Analysis tab se prediction karo</div></div>';
      return;
    }
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
      ${history.map(h => {
        let inp = {}, res = {};
        try { inp = JSON.parse(h.input_data || '{}'); } catch {}
        try { res = JSON.parse(h.result || '{}'); } catch {}
        return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:var(--transition)" onclick="refillFromHistory(${JSON.stringify(inp).replace(/"/g,'&quot;')})" title="Click to refill form">
          <div>
            <div style="font-weight:600;font-size:13px">${inp.product_name || '—'} <span class="badge badge-grey">${h.type}</span></div>
            <div class="text-xs text-muted mt1">${inp.festival || 'No festival'} · ${inp.season || ''} · ${(h.created_at || '').split('.')[0]}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--accent)">${res.predicted_units || '—'} units</div>
            <div class="text-xs" style="color:var(--success)">${res.demand_level || ''} demand</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function refillFromHistory(inp) {
  showTab('analyze');
  setTimeout(() => {
    if (inp.product_name) document.getElementById('p-name').value = inp.product_name;
    if (inp.cost_price)   document.getElementById('p-cost').value = inp.cost_price;
    if (inp.selling_price)document.getElementById('p-sell').value = inp.selling_price;
    if (inp.current_stock)document.getElementById('p-stock').value = inp.current_stock;
    if (inp.reorder_level)document.getElementById('p-reorder').value = inp.reorder_level;
    if (inp.lead_time_days)document.getElementById('p-lead').value = inp.lead_time_days;
    if (inp.discount_pct !== undefined) {
      document.getElementById('p-disc').value = inp.discount_pct;
      updateSlider('p-disc', 'disc-val', '%');
    }
    if (inp.supplier_reliability !== undefined) {
      document.getElementById('p-supp').value = inp.supplier_reliability;
      updateSlider('p-supp', 'supp-val', '');
      updateSuppLabel();
    }
    const setOpt = (id, val) => {
      if (!val) return;
      const el = document.getElementById(id);
      if (!el) return;
      Array.from(el.options).forEach(o => { if (o.value === String(val)) o.selected = true; });
    };
    setOpt('p-cat', inp.category);
    setOpt('p-season', inp.season);
    setOpt('p-festival', inp.festival);
    setOpt('p-month', inp.month);
    updatePriceCalc();
    toast('Form refilled from history', 'info');
  }, 200);
}

/* ── Retrain ──────────────────────────────────── */
async function retrainModels() {
  if (!confirm('ML models ko apni inventory data se retrain karo?')) return;
  toast('Retraining shuru ho gaya...', 'info');
  try {
    const d = await api('/api/predict/retrain', 'POST');
    toast(d.message, d.success ? 'success' : 'warning');
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ── Init ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Set current month
  document.getElementById('p-month').value = new Date().getMonth() + 1;

  // Init all sliders
  updateSlider('p-disc', 'disc-val', '%');
  updateSlider('p-supp', 'supp-val', '');
  updateSuppLabel();

  // Load product name suggestions
  try {
    const meta = await api('/api/predict/metadata');
    const dl = document.getElementById('p-prod-list');
    if (dl) meta.products?.forEach(p => {
      const o = document.createElement('option'); o.value = p; dl.appendChild(o);
    });
  } catch {}

  // Prefill from inventory page
  const pf = sessionStorage.getItem('predict_prefill');
  if (pf) {
    try {
      const item = JSON.parse(pf);
      sessionStorage.removeItem('predict_prefill');
      showTab('analyze');
      setTimeout(() => refillFromHistory(item), 300);
    } catch {}
  }
});
