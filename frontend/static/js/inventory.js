/* ForeSight — Inventory JS */
let _debounce;

function debounceLoad() {
  clearTimeout(_debounce);
  _debounce = setTimeout(loadInventory, 350);
}

async function loadInventory() {
  const tbody = document.getElementById('inv-tbody');
  tbody.innerHTML = '<tr><td colspan="14"><div class="loading"><div class="spinner"></div>Loading...</div></td></tr>';
  const params = new URLSearchParams();
  const cat     = document.getElementById('f-cat')?.value;
  const season  = document.getElementById('f-season')?.value;
  const festival= document.getElementById('f-festival')?.value;
  const month   = document.getElementById('f-month')?.value;
  const search  = document.getElementById('search')?.value.trim();
  const ls      = document.getElementById('f-lowstock')?.checked;
  if (cat)     params.set('category', cat);
  if (season)  params.set('season', season);
  if (festival)params.set('festival', festival);
  if (month)   params.set('month', month);
  if (search)  params.set('search', search);
  if (ls)      params.set('low_stock', '1');
  try {
    const data = await api('/api/inventory/?' + params);
    renderTable(data.items);
    const badge = document.getElementById('count-badge');
    if (badge) badge.textContent = `${data.count} items`;
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="14"><div class="alert alert-error">Failed: ${e.message}</div></td></tr>`;
  }
}

function renderTable(items) {
  const tbody = document.getElementById('inv-tbody');
  if (!items?.length) {
    tbody.innerHTML = `<tr><td colspan="14"><div class="empty-state">
      <div class="empty-state-icon">📦</div>
      <div class="empty-state-title">No products found</div>
      <div class="empty-state-text">Add products manually or upload a CSV file</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-primary btn-sm" onclick="openModal('add-modal')">+ Add Product</button>
        <button class="btn btn-secondary btn-sm" onclick="openModal('upload-modal')">📤 Upload CSV</button>
      </div>
    </div></td></tr>`; return;
  }
  tbody.innerHTML = items.map(item => {
    const margin  = parseFloat(item.margin_pct||0);
    const mc      = margin>30?'green':margin>15?'yellow':'red';
    const isLow   = item.current_stock <= item.reorder_level;
    const festBadge = (item.festival && item.festival!=='None')
      ? `<span class="badge badge-yellow" style="font-size:10px">${item.festival}</span>` : '—';
    const seaBadge  = (item.season && item.season!=='None')
      ? `<span class="badge badge-blue" style="font-size:10px">${item.season}</span>` : '—';
    return `<tr>
      <td><div style="font-weight:600;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${item.product_name}">${item.product_name}</div></td>
      <td><span class="badge badge-purple">${item.category}</span></td>
      <td><span class="text-xs font-mono" style="color:var(--text3)">${item.sku||'—'}</span></td>
      <td class="num">₹${parseFloat(item.cost_price).toFixed(0)}</td>
      <td class="num">₹${parseFloat(item.selling_price).toFixed(0)}</td>
      <td><span class="badge badge-${mc}">${fPct(margin)}</span></td>
      <td class="num">${fNum(item.units_sold)}</td>
      <td class="num" style="color:${isLow?'var(--danger)':'var(--text)'};font-weight:${isLow?'700':'400'}">${item.current_stock}${isLow?' ⚠️':''}</td>
      <td class="num" style="color:var(--text3)">${item.reorder_level}</td>
      <td class="num" style="color:var(--success);font-weight:600">${fINR(item.profit)}</td>
      <td>${seaBadge}</td>
      <td>${festBadge}</td>
      <td class="text-xs text-muted">${item.date||'—'}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openEdit(${JSON.stringify(item).replace(/"/g,'&quot;')})" title="Edit">✏️</button>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="predictThis(${JSON.stringify(item).replace(/"/g,'&quot;')})" title="AI Predict">🔮</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="delItem(${item.id})" title="Delete">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function calcMargin() {
  const cost = parseFloat(document.getElementById('a-cost').value)||0;
  const sell = parseFloat(document.getElementById('a-sell').value)||0;
  const disc = parseFloat(document.getElementById('a-disc').value)||0;
  const qty  = parseFloat(document.getElementById('a-sold').value)||0;
  const prev = document.getElementById('margin-preview');
  if (cost>0 && sell>0) {
    const effSell = sell*(1-disc/100);
    const margin  = effSell - cost;
    const pct     = (margin/cost*100);
    document.getElementById('prev-margin').textContent = `₹${margin.toFixed(2)}`;
    document.getElementById('prev-pct').textContent    = `${pct.toFixed(1)}%`;
    document.getElementById('prev-total').textContent  = fINR(margin*qty);
    prev.style.display = 'block';
  } else { prev.style.display='none'; }
}

async function addProduct() {
  const name = document.getElementById('a-name').value.trim();
  const cat  = document.getElementById('a-cat').value;
  const cost = document.getElementById('a-cost').value;
  const sell = document.getElementById('a-sell').value;
  const alertEl = document.getElementById('add-alert');
  alertEl.innerHTML = '';
  if (!name||!cost||!sell) { alertEl.innerHTML='<div class="alert alert-error">Name, Cost Price and Selling Price are required</div>'; return; }
  const data = {
    product_name: name, category: cat,
    cost_price: cost, selling_price: sell,
    discount_pct: document.getElementById('a-disc').value||0,
    units_sold:   document.getElementById('a-sold').value||0,
    current_stock:document.getElementById('a-stock').value||0,
    reorder_level:document.getElementById('a-reorder').value||10,
    lead_time_days:document.getElementById('a-lead').value||3,
    supplier_reliability:(document.getElementById('a-supp').value===''||isNaN(document.getElementById('a-supp').value))?0.9:parseFloat(document.getElementById('a-supp').value),
    season:  document.getElementById('a-season').value,
    festival:document.getElementById('a-festival').value,
    region:  document.getElementById('a-region').value,
    date:    document.getElementById('a-date').value,
    sku:     document.getElementById('a-sku').value.trim(),
  };
  try {
    await api('/api/inventory/add','POST',data);
    closeModal('add-modal');
    toast(`✅ "${name}" added to inventory!`);
    loadInventory();
    // Reset form
    ['a-name','a-cost','a-sell','a-disc','a-sold','a-stock','a-sku'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('a-reorder').value='10';
    document.getElementById('a-lead').value='3';
    document.getElementById('a-supp').value='0.9';
    document.getElementById('margin-preview').style.display='none';
    alertEl.innerHTML='';
  } catch(e) { alertEl.innerHTML=`<div class="alert alert-error">${e.message}</div>`; }
}

async function delItem(id) {
  if (!confirm('Is product ko delete karna chahte ho?')) return;
  try {
    await api(`/api/inventory/${id}`, 'DELETE');
    toast('✅ Product deleted', 'success');
    await loadInventory();
  } catch(e) {
    toast('❌ Delete failed: ' + e.message, 'error');
    console.error('Delete error:', e);
  }
}

function openEdit(item) {
  document.getElementById('edit-id').value   = item.id;
  document.getElementById('e-name').value    = item.product_name;
  document.getElementById('e-cost').value    = item.cost_price;
  document.getElementById('e-sell').value    = item.selling_price;
  document.getElementById('e-disc').value    = item.discount_pct||0;
  document.getElementById('e-sold').value    = item.units_sold||0;
  document.getElementById('e-stock').value   = item.current_stock||0;
  document.getElementById('e-reorder').value = item.reorder_level||10;
  ['e-cat','e-season','e-festival'].forEach(id=>{
    const el=document.getElementById(id);
    const key={'e-cat':'category','e-season':'season','e-festival':'festival'}[id];
    if(el&&item[key]){Array.from(el.options).forEach(o=>{if(o.value===item[key])o.selected=true;});}
  });
  openModal('edit-modal');
}

async function saveEdit() {
  const id = document.getElementById('edit-id').value;
  const data = {
    product_name: document.getElementById('e-name').value,
    category:     document.getElementById('e-cat').value,
    cost_price:   document.getElementById('e-cost').value,
    selling_price:document.getElementById('e-sell').value,
    discount_pct: document.getElementById('e-disc').value,
    units_sold:   document.getElementById('e-sold').value,
    current_stock:document.getElementById('e-stock').value,
    reorder_level:document.getElementById('e-reorder').value,
    season:       document.getElementById('e-season').value,
    festival:     document.getElementById('e-festival').value,
  };
  try {
    await api(`/api/inventory/${id}`,'PUT',data);
    closeModal('edit-modal'); toast('Product updated!'); loadInventory();
  } catch(e) { document.getElementById('edit-alert').innerHTML=`<div class="alert alert-error">${e.message}</div>`; }
}

function predictThis(item) {
  sessionStorage.setItem('predict_prefill', JSON.stringify(item));
  location.href = '/predict';
}

function clearFilters() {
  ['f-cat','f-season','f-festival','f-month'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const ls=document.getElementById('f-lowstock'); if(ls) ls.checked=false;
  const s=document.getElementById('search'); if(s) s.value='';
  loadInventory();
}

// CSV Upload
let _file = null;
function fileChosen(e) { setFile(e.target.files[0]); }
function handleDrop(e) {
  e.preventDefault(); document.getElementById('drop-zone').style.borderColor='var(--border)';
  const f = e.dataTransfer.files[0];
  if (f&&f.name.endsWith('.csv')) setFile(f); else toast('CSV files only','error');
}
function setFile(f) {
  _file=f;
  const fi=document.getElementById('file-info');
  document.getElementById('file-name').textContent = f.name;
  document.getElementById('file-size').textContent = `${(f.size/1024).toFixed(1)} KB`;
  fi.style.display='flex';
  document.getElementById('upload-btn').disabled=false;
}
async function doUpload() {
  if (!_file) return;
  const btn=document.getElementById('upload-btn');
  btn.disabled=true; btn.textContent='Uploading...';
  document.getElementById('upload-progress').style.display='block';
  document.getElementById('prog-bar').style.width='40%';
  const fd=new FormData(); fd.append('file',_file);
  try {
    document.getElementById('prog-bar').style.width='80%';
    const res=await fetch('/api/inventory/upload-csv',{method:'POST',body:fd,credentials:'include'});
    const d=await res.json();
    document.getElementById('prog-bar').style.width='100%';
    if (res.ok) {
      document.getElementById('upload-alert').innerHTML=`<div class="alert alert-success">${d.message}</div>`;
      toast(d.message); setTimeout(()=>{closeModal('upload-modal');loadInventory();},1200);
    } else { document.getElementById('upload-alert').innerHTML=`<div class="alert alert-error">${d.error}<br>${d.your_columns?'Your columns: '+d.your_columns.join(', '):''}</div>`; }
  } catch(e) { document.getElementById('upload-alert').innerHTML=`<div class="alert alert-error">${e.message}</div>`; }
  btn.disabled=false; btn.textContent='Upload & Import';
  document.getElementById('upload-progress').style.display='none';
}

function downloadTemplate() {
  window.open('/api/inventory/template','_blank');
}

document.addEventListener('DOMContentLoaded',()=>{
  loadInventory();
  document.getElementById('a-date').value=new Date().toISOString().split('T')[0];
});

async function loadSampleData() {
  if (!confirm('Ramesh General Store ka kirana data load karein? (83 products, real data)')) return;
  const { message } = await api('/api/inventory/load-sample-data', 'POST').catch(e => { toast(e.message,'error'); return {}; });
  if (message) { toast(message, 'success', 4000); setTimeout(loadInventory, 800); }
}
