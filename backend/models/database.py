"""
ForeSight - Database Layer (SQLite)
Full schema: users, inventory, predictions, notifications, settings
"""
import sqlite3, os, hashlib, json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'foresight.db')


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT NOT NULL,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            shop_name   TEXT DEFAULT 'My Shop',
            business_type TEXT DEFAULT 'Retail',
            role        TEXT DEFAULT 'user',
            avatar_color TEXT DEFAULT '#6c63ff',
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,
            product_name    TEXT NOT NULL,
            category        TEXT NOT NULL,
            sku             TEXT,
            cost_price      REAL NOT NULL,
            selling_price   REAL NOT NULL,
            margin_pct      REAL DEFAULT 0,
            discount_pct    REAL DEFAULT 0,
            units_sold      INTEGER DEFAULT 0,
            current_stock   INTEGER DEFAULT 0,
            reorder_level   INTEGER DEFAULT 10,
            lead_time_days  INTEGER DEFAULT 3,
            holding_cost    REAL DEFAULT 0,
            supplier_reliability REAL DEFAULT 0.9,
            season          TEXT DEFAULT 'None',
            festival        TEXT DEFAULT 'None',
            region          TEXT DEFAULT 'General',
            revenue         REAL DEFAULT 0,
            profit          REAL DEFAULT 0,
            investment      REAL DEFAULT 0,
            month           INTEGER,
            year            INTEGER,
            date            TEXT,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS predictions_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            type        TEXT NOT NULL,
            input_data  TEXT,
            result      TEXT,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            title       TEXT NOT NULL,
            message     TEXT NOT NULL,
            type        TEXT DEFAULT 'info',
            is_read     INTEGER DEFAULT 0,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS user_settings (
            user_id         INTEGER PRIMARY KEY,
            currency        TEXT DEFAULT 'INR',
            low_stock_threshold INTEGER DEFAULT 10,
            default_season  TEXT DEFAULT 'Summer',
            notify_low_stock INTEGER DEFAULT 1,
            notify_predictions INTEGER DEFAULT 1,
            theme           TEXT DEFAULT 'dark',
            business_type   TEXT DEFAULT 'Retail',
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS csv_imports (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            filename    TEXT,
            rows_added  INTEGER DEFAULT 0,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()
    print("✅ Database ready")


# ─── User helpers ────────────────────────────────────────────────
def _hash(pw): return hashlib.sha256(pw.encode()).hexdigest()

def create_user(username, email, password, shop_name='My Shop', business_type='Retail'):
    conn = get_db()
    colors = ['#6c63ff','#ff6b6b','#ffd93d','#4ade80','#38bdf8','#f472b6']
    import random; color = random.choice(colors)
    try:
        conn.execute(
            "INSERT INTO users (username,email,password,shop_name,business_type,avatar_color) VALUES(?,?,?,?,?,?)",
            (username, email, _hash(password), shop_name, business_type, color)
        )
        conn.commit()
        uid = conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()[0]
        # Init default settings
        conn.execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES(?)", (uid,))
        conn.commit()
        return True, "Account created"
    except sqlite3.IntegrityError:
        return False, "Email already registered"
    finally:
        conn.close()

def verify_user(email, password):
    conn = get_db()
    u = conn.execute("SELECT * FROM users WHERE email=? AND password=?", (email, _hash(password))).fetchone()
    conn.close()
    return dict(u) if u else None

def get_user(uid):
    conn = get_db()
    u = conn.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return dict(u) if u else None

def get_all_users():
    conn = get_db()
    rows = conn.execute("SELECT id,username,email,shop_name,role,created_at FROM users ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_user(uid, data):
    conn = get_db()
    allowed = ['username','shop_name','business_type','avatar_color']
    sets = []; vals = []
    for k in allowed:
        if k in data:
            sets.append(f"{k}=?"); vals.append(data[k])
    if sets:
        vals.append(uid)
        conn.execute(f"UPDATE users SET {','.join(sets)} WHERE id=?", vals)
        conn.commit()
    conn.close()


# ─── Inventory helpers ────────────────────────────────────────────
def add_item(user_id, d):
    conn = get_db()
    cost = float(d.get('cost_price', 0))
    sell = float(d.get('selling_price', 0))
    qty  = int(d.get('units_sold', 0))
    margin = round((sell-cost)/max(cost,1)*100, 2)
    revenue = qty * sell * (1 - float(d.get('discount_pct',0))/100)
    investment = qty * cost
    profit = revenue - investment
    dt = d.get('date') or datetime.now().strftime('%Y-%m-%d')
    try: mo, yr = int(dt[5:7]), int(dt[:4])
    except: mo, yr = datetime.now().month, datetime.now().year

    import random, string
    sku = d.get('sku') or ('SKU-' + ''.join(random.choices(string.ascii_uppercase+string.digits, k=6)))

    conn.execute("""
        INSERT INTO inventory
        (user_id,product_name,category,sku,cost_price,selling_price,margin_pct,
         discount_pct,units_sold,current_stock,reorder_level,lead_time_days,
         holding_cost,supplier_reliability,season,festival,region,
         revenue,profit,investment,month,year,date)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (user_id, d['product_name'], d['category'], sku, cost, sell, margin,
          float(d.get('discount_pct',0)), qty,
          int(d.get('current_stock',0)), int(d.get('reorder_level',10)),
          int(d.get('lead_time_days',3)), float(d.get('holding_cost',cost*0.02)),
          float(d.get('supplier_reliability',0.9)),
          d.get('season','None'), d.get('festival','None'), d.get('region','General'),
          round(revenue,2), round(profit,2), round(investment,2), mo, yr, dt))
    conn.commit()
    iid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()

    # Auto-create low stock notification
    stock = int(d.get('current_stock', 0))
    reorder = int(d.get('reorder_level', 10))
    if stock <= reorder:
        add_notification(user_id, "⚠️ Low Stock Alert",
            f"{d['product_name']} has only {stock} units left (reorder level: {reorder})", "warning")
    return iid

def get_items(user_id, filters=None):
    conn = get_db()
    q = "SELECT * FROM inventory WHERE user_id=?"
    p = [user_id]
    if filters:
        for col in ['category','season','festival','month','year']:
            if filters.get(col):
                q += f" AND {col}=?"; p.append(filters[col])
        if filters.get('search'):
            q += " AND (product_name LIKE ? OR sku LIKE ?)"; s=f"%{filters['search']}%"; p+=[s,s]
        if filters.get('low_stock') == '1':
            q += " AND current_stock <= reorder_level"
    q += " ORDER BY created_at DESC"
    rows = conn.execute(q, p).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_item(user_id, item_id, d):
    conn = get_db()
    item = conn.execute("SELECT * FROM inventory WHERE id=? AND user_id=?", (item_id, user_id)).fetchone()
    if not item: conn.close(); return False
    allowed = ['product_name','category','cost_price','selling_price','discount_pct',
               'units_sold','current_stock','reorder_level','lead_time_days',
               'holding_cost','supplier_reliability','season','festival','region','date']
    sets=[]; vals=[]
    for k in allowed:
        if k in d: sets.append(f"{k}=?"); vals.append(d[k])
    # Recalc derived
    cost = float(d.get('cost_price', item['cost_price']))
    sell = float(d.get('selling_price', item['selling_price']))
    disc = float(d.get('discount_pct', item['discount_pct']))
    qty  = int(d.get('units_sold', item['units_sold']))
    margin = round((sell-cost)/max(cost,1)*100, 2)
    rev = qty * sell * (1-disc/100)
    inv = qty * cost
    sets += ['margin_pct=?','revenue=?','profit=?','investment=?']
    vals += [margin, round(rev,2), round(rev-inv,2), round(inv,2)]
    vals.append(item_id); vals.append(user_id)
    conn.execute(f"UPDATE inventory SET {','.join(sets)} WHERE id=? AND user_id=?", vals)
    conn.commit(); conn.close()
    return True

def delete_item(user_id, item_id):
    conn = get_db()
    conn.execute("DELETE FROM inventory WHERE id=? AND user_id=?", (item_id, user_id))
    conn.commit(); conn.close()

def get_item(user_id, item_id):
    conn = get_db()
    r = conn.execute("SELECT * FROM inventory WHERE id=? AND user_id=?", (item_id, user_id)).fetchone()
    conn.close()
    return dict(r) if r else None


# ─── Dashboard stats ──────────────────────────────────────────────
def get_stats(user_id):
    conn = get_db()
    s = conn.execute("""
        SELECT COUNT(*) total_products,
               COALESCE(SUM(revenue),0) total_revenue,
               COALESCE(SUM(profit),0) total_profit,
               COALESCE(SUM(units_sold),0) total_units,
               COALESCE(AVG(margin_pct),0) avg_margin,
               COALESCE(SUM(current_stock),0) total_stock,
               COUNT(CASE WHEN current_stock<=reorder_level THEN 1 END) low_stock_count,
               COALESCE(SUM(investment),0) total_investment
        FROM inventory WHERE user_id=?
    """, (user_id,)).fetchone()

    monthly = conn.execute("""
        SELECT year,month,SUM(revenue) revenue,SUM(profit) profit,
               SUM(units_sold) units,COUNT(*) products
        FROM inventory WHERE user_id=?
        GROUP BY year,month ORDER BY year,month
    """, (user_id,)).fetchall()

    by_cat = conn.execute("""
        SELECT category,SUM(revenue) revenue,SUM(profit) profit,
               SUM(units_sold) units,AVG(margin_pct) avg_margin,
               COUNT(DISTINCT product_name) product_count
        FROM inventory WHERE user_id=?
        GROUP BY category ORDER BY revenue DESC
    """, (user_id,)).fetchall()

    by_season = conn.execute("""
        SELECT season,SUM(revenue) revenue,SUM(profit) profit,SUM(units_sold) units
        FROM inventory WHERE user_id=? AND season!='None'
        GROUP BY season ORDER BY revenue DESC
    """, (user_id,)).fetchall()

    by_festival = conn.execute("""
        SELECT festival,SUM(units_sold) units,SUM(profit) profit,SUM(revenue) revenue
        FROM inventory WHERE user_id=? AND festival!='None'
        GROUP BY festival ORDER BY units DESC LIMIT 10
    """, (user_id,)).fetchall()

    top_products = conn.execute("""
        SELECT product_name,category,SUM(units_sold) units,
               SUM(profit) profit,SUM(revenue) revenue,AVG(margin_pct) margin
        FROM inventory WHERE user_id=?
        GROUP BY product_name ORDER BY profit DESC LIMIT 10
    """, (user_id,)).fetchall()

    low_stock = conn.execute("""
        SELECT product_name,category,current_stock,reorder_level,
               selling_price,lead_time_days
        FROM inventory WHERE user_id=? AND current_stock<=reorder_level
        ORDER BY current_stock ASC LIMIT 20
    """, (user_id,)).fetchall()

    conn.close()
    return {
        'summary': dict(s),
        'monthly': [dict(r) for r in monthly],
        'by_category': [dict(r) for r in by_cat],
        'by_season': [dict(r) for r in by_season],
        'by_festival': [dict(r) for r in by_festival],
        'top_products': [dict(r) for r in top_products],
        'low_stock': [dict(r) for r in low_stock],
    }


# ─── Notifications ────────────────────────────────────────────────
def add_notification(user_id, title, message, ntype='info'):
    conn = get_db()
    conn.execute("INSERT INTO notifications (user_id,title,message,type) VALUES(?,?,?,?)",
                 (user_id, title, message, ntype))
    conn.commit(); conn.close()

def get_notifications(user_id, unread_only=False):
    conn = get_db()
    q = "SELECT * FROM notifications WHERE user_id=?"
    if unread_only: q += " AND is_read=0"
    q += " ORDER BY created_at DESC LIMIT 50"
    rows = conn.execute(q, (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def mark_read(user_id, nid=None):
    conn = get_db()
    if nid:
        conn.execute("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?", (nid, user_id))
    else:
        conn.execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (user_id,))
    conn.commit(); conn.close()


# ─── Settings ─────────────────────────────────────────────────────
def get_settings(user_id):
    conn = get_db()
    r = conn.execute("SELECT * FROM user_settings WHERE user_id=?", (user_id,)).fetchone()
    if not r:
        conn.execute("INSERT OR IGNORE INTO user_settings (user_id) VALUES(?)", (user_id,))
        conn.commit()
        r = conn.execute("SELECT * FROM user_settings WHERE user_id=?", (user_id,)).fetchone()
    conn.close()
    return dict(r) if r else {}

def save_settings(user_id, data):
    conn = get_db()
    allowed = ['currency','low_stock_threshold','default_season','notify_low_stock',
               'notify_predictions','theme','business_type']
    sets=[]; vals=[]
    for k in allowed:
        if k in data: sets.append(f"{k}=?"); vals.append(data[k])
    if sets:
        vals.append(user_id)
        conn.execute(f"UPDATE user_settings SET {','.join(sets)} WHERE user_id=?", vals)
        conn.commit()
    conn.close()


# ─── Prediction log ───────────────────────────────────────────────
def log_prediction(user_id, ptype, inp, result):
    conn = get_db()
    conn.execute("INSERT INTO predictions_log (user_id,type,input_data,result) VALUES(?,?,?,?)",
                 (user_id, ptype, json.dumps(inp), json.dumps(result)))
    conn.commit(); conn.close()

def get_prediction_history(user_id, limit=20):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM predictions_log WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
        (user_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
