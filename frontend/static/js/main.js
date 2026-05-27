/* ═══════════════════════════════════════════════════
   ForeSight — Global JS Utilities
   ═══════════════════════════════════════════════════ */

/* ── Chart.js global config ─────────────────────── */
if (window.Chart) {
  Chart.defaults.color = '#9ba3c4';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.font.family = "'Space Grotesk', sans-serif";
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.padding  = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = '#181c2e';
  Chart.defaults.plugins.tooltip.borderColor     = 'rgba(108,99,255,0.3)';
  Chart.defaults.plugins.tooltip.borderWidth     = 1;
  Chart.defaults.plugins.tooltip.padding         = 12;
  Chart.defaults.plugins.tooltip.titleFont       = { size:13, weight:'bold' };
  Chart.defaults.plugins.tooltip.bodyFont        = { size:12 };
  Chart.defaults.plugins.tooltip.cornerRadius    = 10;
}

const C = {
  purple:'rgba(108,99,255,1)',  purpleA:'rgba(108,99,255,0.15)',
  pink:  'rgba(255,107,157,1)', pinkA:  'rgba(255,107,157,0.15)',
  cyan:  'rgba(0,212,255,1)',   cyanA:  'rgba(0,212,255,0.15)',
  green: 'rgba(0,230,118,1)',   greenA: 'rgba(0,230,118,0.15)',
  yellow:'rgba(255,217,61,1)',  yellowA:'rgba(255,217,61,0.15)',
  red:   'rgba(255,82,82,1)',   redA:   'rgba(255,82,82,0.15)',
  palette: [
    'rgba(108,99,255,0.85)','rgba(255,107,157,0.85)','rgba(0,212,255,0.85)',
    'rgba(0,230,118,0.85)','rgba(255,217,61,0.85)','rgba(255,82,82,0.85)',
    'rgba(167,139,250,0.85)','rgba(52,211,153,0.85)','rgba(251,191,36,0.85)',
    'rgba(96,165,250,0.85)','rgba(248,113,133,0.85)','rgba(74,222,128,0.85)',
  ]
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ── THEME SYSTEM ───────────────────────────────── */
const THEME_KEY = 'foresight_theme';

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function applyTheme(theme) {
  document.body.classList.toggle('light-mode', theme === 'light');
  // Update all theme toggle buttons
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = theme === 'light' ? '🌙' : '☀️';
    btn.title = theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
  });
  // Update chart colors if charts exist
  if (window.Chart) {
    const textColor = theme === 'light' ? '#4a5080' : '#9ba3c4';
    const borderColor = theme === 'light' ? 'rgba(108,99,255,0.1)' : 'rgba(255,255,255,0.06)';
    const tooltipBg = theme === 'light' ? '#ffffff' : '#181c2e';
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = borderColor;
    Chart.defaults.plugins.tooltip.backgroundColor = tooltipBg;
  }
}

function toggleTheme() {
  const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, newTheme);
  applyTheme(newTheme);
}

/* ── API helper ─────────────────────────────────── */
async function api(url, method='GET', body=null) {
  const opts = { method, credentials:'include', headers:{} };
  if (body) { opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(body); }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── Toast notifications ────────────────────────── */
function toast(msg, type='success', duration=3500) {
  const box = document.getElementById('toast-box') || (() => {
    const d=document.createElement('div'); d.id='toast-box'; d.className='toast-box';
    document.body.appendChild(d); return d;
  })();
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'📢'}</span><span style="flex:1">${msg}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.style.transition='0.3s'; t.style.opacity='0'; t.style.transform='translateX(100%)';
    setTimeout(()=>t.remove(), 300); }, duration);
}

/* ── Format helpers ─────────────────────────────── */
function fINR(n, showDecimals=false) {
  n = parseFloat(n) || 0;
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return sign + '₹' + (abs/10000000).toFixed(1) + 'Cr';
  if (abs >= 100000)   return sign + '₹' + (abs/100000).toFixed(1) + 'L';
  if (abs >= 1000)     return sign + '₹' + (abs/1000).toFixed(1) + 'K';
  return sign + '₹' + (showDecimals ? abs.toFixed(2) : abs.toFixed(0));
}
function fNum(n) { return (parseFloat(n)||0).toLocaleString('en-IN'); }
function fPct(n) { return (parseFloat(n)||0).toFixed(1) + '%'; }

/* ── Auth helpers ───────────────────────────────── */
async function checkAuth(redirect=true) {
  try {
    const d = await api('/api/auth/check');
    if (!d.ok && redirect && !['/','login'].some(p => location.pathname.includes(p))) {
      location.href = '/login';
    }
    return d.ok;
  } catch { if(redirect) location.href='/login'; return false; }
}

async function loadUser() {
  try {
    const { user } = await api('/api/auth/me');
    const nameEl   = document.getElementById('user-name');
    const shopEl   = document.getElementById('user-shop');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl)   nameEl.textContent  = user.username;
    if (shopEl)   shopEl.textContent  = user.role === 'admin' ? '👑 Admin' : user.shop_name;
    if (avatarEl) {
      avatarEl.textContent = user.username[0].toUpperCase();
      if (user.avatar_color) avatarEl.style.background = user.avatar_color;
    }
    return user;
  } catch(e) { return null; }
}

async function logout() {
  await api('/api/auth/logout','POST').catch(()=>{});
  location.href = '/';
}

/* ── Modal helpers ──────────────────────────────── */
function openModal(id)  { document.getElementById(id).style.display='flex'; }
function closeModal(id) { document.getElementById(id).style.display='none'; }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.style.display='none';
});

/* ── Notifications ───────────────────────────────── */
async function loadNotifCount() {
  try {
    const { unread_count } = await api('/api/notifications/?unread=1');
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = unread_count > 0 ? 'block' : 'none';
    const cnt = document.getElementById('notif-count');
    if (cnt) cnt.textContent = unread_count || '';
  } catch {}
}

async function toggleNotifPanel() {
  let panel = document.getElementById('notif-panel');
  if (panel) { panel.remove(); return; }
  panel = document.createElement('div');
  panel.id = 'notif-panel'; panel.className = 'notif-panel';
  try {
    const { notifications } = await api('/api/notifications/');
    if (!notifications.length) {
      panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3)">🔔 No notifications</div>';
    } else {
      const header = `<div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;font-size:14px">Notifications</span>
        <button onclick="markAllRead()" class="btn btn-sm btn-secondary" style="font-size:11px;padding:4px 10px">Mark all read</button>
      </div>`;
      const items = notifications.map(n => `
        <div class="notif-item ${n.is_read?'':'unread'}" onclick="markRead(${n.id},this)">
          <div class="notif-title">${n.title}</div>
          <div class="notif-msg">${n.message}</div>
          <div class="notif-msg" style="margin-top:4px">${timeAgo(n.created_at)}</div>
        </div>`).join('');
      panel.innerHTML = header + items;
    }
  } catch { panel.innerHTML = '<div style="padding:20px;color:var(--danger)">Failed to load</div>'; }
  document.body.appendChild(panel);
  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && !e.target.closest('.notif-btn')) panel.remove();
  }, { once:true });
}

async function markRead(id, el) {
  await api(`/api/notifications/read/${id}`, 'POST').catch(()=>{});
  if (el) el.classList.remove('unread');
  loadNotifCount();
}
async function markAllRead() {
  await api('/api/notifications/read-all','POST').catch(()=>{});
  document.getElementById('notif-panel')?.remove();
  loadNotifCount();
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts.replace(' ','T')), now = new Date();
  const diff = Math.floor((now-d)/1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

/* ── Confidence bar ─────────────────────────────── */
function confidenceBar(pct, label='Model Confidence') {
  const col = pct>75?'var(--success)':pct>50?'var(--warning)':'var(--danger)';
  return `<div style="margin-top:6px">
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:5px">
      <span>${label}</span><span style="color:${col};font-weight:700">${pct}%</span>
    </div>
    <div class="progress"><div class="progress-bar purple" style="width:${pct}%;background:${col}"></div></div>
  </div>`;
}

/* ── Number animation ───────────────────────────── */
function animateNum(el, target, prefix='', suffix='', duration=1200) {
  const start = 0, step = target / (duration / 16);
  let cur = start;
  const timer = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = prefix + fNum(Math.round(cur)) + suffix;
    if (cur >= target) clearInterval(timer);
  }, 16);
}

/* ── Demand badge ───────────────────────────────── */
function demandBadge(level) {
  const map = { High:'green', Medium:'yellow', Low:'red' };
  const icons = { High:'🔥', Medium:'📊', Low:'📉' };
  return `<span class="badge badge-${map[level]||'grey'}">${icons[level]||''}${level}</span>`;
}

/* ── Set active nav ─────────────────────────────── */
function setActiveNav() {
  const path = location.pathname;
  document.querySelectorAll('.nav-link').forEach(a => {
    const href = a.getAttribute('href') || '';
    a.classList.toggle('active', href && path.startsWith(href) && href !== '/');
  });
}

/* ── Page init merged into sidebar account section below ── */

/* ══════════════════════════════════════════════════════════
   SIDEBAR ACCOUNT SYSTEM
   - Shows login/register if logged out
   - Shows user card + Switch/Logout buttons if logged in
   - Account Switch Panel: switch between multiple accounts
   ══════════════════════════════════════════════════════════ */

// In-memory account store (saved to localStorage for session persistence)
const ACCOUNTS_KEY = 'foresight_accounts'; // [{email, username, shop_name, uid, avatar_color}]

function getSavedAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); }
  catch { return []; }
}

function saveAccount(user) {
  const accounts = getSavedAccounts();
  const idx = accounts.findIndex(a => a.uid === user.id);
  const entry = {
    uid: user.id,
    username: user.username,
    email: user.email,
    shop_name: user.shop_name || '',
    avatar_color: user.avatar_color || 'linear-gradient(135deg,#6c63ff,#ff6b9d)',
  };
  if (idx >= 0) accounts[idx] = entry;
  else accounts.push(entry);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function removeAccount(uid) {
  const accounts = getSavedAccounts().filter(a => a.uid !== uid);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getAvatarLetter(name) {
  return (name || 'U')[0].toUpperCase();
}

/* ── Render sidebar account section ─────────────────────────── */
async function renderSidebarAccount() {
  const container = document.getElementById('sidebar-account');
  if (!container) return;

  try {
    const { ok } = await api('/api/auth/check');

    if (!ok) {
      // ── LOGGED OUT ──────────────────────────────────────────
      container.innerHTML = `
        <a href="/login" class="sidebar-login-btn">🔑 Login to ForeSight</a>
        <a href="/login?tab=register" class="sidebar-register-link">Don't have account? Register →</a>`;
      return;
    }

    // ── LOGGED IN ───────────────────────────────────────────
    const { user } = await api('/api/auth/me');
    saveAccount(user); // keep account in memory

    const avatarStyle = user.avatar_color
      ? `style="background:${user.avatar_color}"`
      : '';

    container.innerHTML = `
      <div class="user-card" onclick="toggleSwitchPanel()">
        <div class="user-avatar" id="user-avatar" ${avatarStyle}>${getAvatarLetter(user.username)}</div>
        <div class="user-info">
          <div class="user-name" id="user-name">${user.username}</div>
          <div class="user-role" id="user-shop">${user.role === 'admin' ? '👑 Admin' : (user.shop_name || 'My Shop')}</div>
        </div>
        <span style="color:var(--text3);font-size:12px">⇅</span>
      </div>
      <div class="user-card-actions">
        <button class="user-action-btn switch" onclick="toggleSwitchPanel()">⇄ Switch</button>
        <a href="/settings" class="user-action-btn">⚙ Profile</a>
        <button class="user-action-btn danger" onclick="logout()">⎋ Logout</button>
      </div>`;

  } catch {
    // fallback — show login button
    container.innerHTML = `
      <a href="/login" class="sidebar-login-btn">🔑 Login to ForeSight</a>`;
  }
}

/* ── Switch Account Panel ───────────────────────────────────── */
async function toggleSwitchPanel() {
  const existing = document.getElementById('switch-panel');
  if (existing) { existing.remove(); return; }

  const panel = document.createElement('div');
  panel.id = 'switch-panel';
  panel.className = 'switch-panel';

  let currentUid = null;
  try { const c = await api('/api/auth/check'); currentUid = c.uid; } catch {}

  const accounts = getSavedAccounts();

  const accountItems = accounts.length
    ? accounts.map(acc => `
        <div class="account-item ${acc.uid === currentUid ? 'active-acc' : ''}"
             onclick="switchToAccount(${acc.uid}, '${escHtml(acc.email)}')">
          <div class="account-item-avatar" style="background:${acc.avatar_color || 'linear-gradient(135deg,#6c63ff,#ff6b9d)'}">
            ${getAvatarLetter(acc.username)}
          </div>
          <div class="account-item-info">
            <div class="account-item-name">${escHtml(acc.username)}</div>
            <div class="account-item-email">${escHtml(acc.email)}</div>
          </div>
          ${acc.uid === currentUid ? '<span class="account-item-tick">✓</span>' : ''}
        </div>`).join('')
    : '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">No saved accounts</div>';

  panel.innerHTML = `
    <div class="switch-panel-header">
      <span>Switch Account</span>
      <button class="switch-panel-close" onclick="document.getElementById('switch-panel').remove()">✕</button>
    </div>
    ${accountItems}
    <div class="switch-panel-footer">
      <button class="add-account-btn" onclick="addNewAccount()">+ Add Another Account</button>
    </div>`;

  document.body.appendChild(panel);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeSP(e) {
      if (!panel.contains(e.target) && !e.target.closest('.user-card') && !e.target.closest('.user-action-btn.switch')) {
        panel.remove();
        document.removeEventListener('click', closeSP);
      }
    });
  }, 100);
}

async function switchToAccount(uid, email) {
  document.getElementById('switch-panel')?.remove();
  if (!uid) return;

  // Check if already on this account
  try {
    const { uid: current } = await api('/api/auth/check');
    if (current === uid) { toast('Already on this account', 'info'); return; }
  } catch {}

  // Need to logout first and prompt for password
  // Since we don't store passwords (security!), redirect to login with email pre-filled
  await api('/api/auth/logout', 'POST').catch(() => {});
  sessionStorage.setItem('switch_email', email);
  toast('Please login to switch account', 'info', 2000);
  setTimeout(() => { location.href = '/login?switch=1'; }, 1000);
}

async function addNewAccount() {
  document.getElementById('switch-panel')?.remove();
  await api('/api/auth/logout', 'POST').catch(() => {});
  location.href = '/login';
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Override DOMContentLoaded to also render sidebar account ── */
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(getTheme());
  const isPublic = ['/', '/login'].includes(location.pathname);
  if (!isPublic) {
    const ok = await checkAuth(true);
    if (!ok) return;
    loadNotifCount();
    setActiveNav();
  }
  // Always render sidebar account (handles both logged-in and logged-out state)
  renderSidebarAccount();
});
