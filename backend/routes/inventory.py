from flask import Blueprint, request, jsonify, session
from backend.models.database import add_item, get_items, update_item, delete_item, get_item, add_notification
from backend.routes.auth import login_required
import pandas as pd, io

inventory_bp = Blueprint('inventory', __name__)

FESTIVALS = ['None','Diwali','Holi','Eid','Christmas','Navratri','Dussehra',
             'Raksha Bandhan','Janmashtami','Onam','Pongal','Makar Sankranti',
             "Valentine's Day","Independence Day","Republic Day","Children's Day",
             'Ganesh Chaturthi','Chhath Puja','Baisakhi','Lohri','Maha Shivratri',
             'Basant Panchami','Bihu','Ugadi','New Year','Labour Day']
SEASONS  = ['None','Summer','Winter','Rainy','Autumn']
CATEGORIES = ['FMCG','Electronics','Fashion','Grocery','Stationery','Agriculture']


@inventory_bp.route('/load-sample-data', methods=['POST'])
@login_required
def load_sample_data():
    """Load Ramesh General Store sample kirana data for demo"""
    import pandas as pd, os
    from backend.models.database import add_item, add_notification, get_db
    
    uid = session['uid']
    
    # Check if user already has data
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM inventory WHERE user_id=?", (uid,)).fetchone()[0]
    conn.close()
    if count > 0:
        return jsonify({'message': f'Already have {count} records. Delete existing first.', 'added': 0})
    
    try:
        csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                                'data', 'kirana_train_7000.csv')
        df = pd.read_csv(csv_path)
        # Take 1 row per product (latest, best representative)
        df_sample = df.sort_values('month').groupby('product_name').tail(1).reset_index(drop=True)
        
        added = 0
        for _, row in df_sample.iterrows():
            d = row.to_dict()
            d['product_name'] = str(d.get('product_name', ''))
            d['category'] = str(d.get('category', 'Grocery'))
            if not d['product_name']: continue
            add_item(uid, d)
            added += 1
        
        add_notification(uid, "🏪 Sample Data Loaded", 
                        f"Ramesh General Store ka {added} products ka data load ho gaya!", "success")
        return jsonify({'message': f'✅ {added} kirana products loaded successfully!', 'added': added})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/', methods=['GET'])
@login_required
def list_items():
    filters = {k: request.args.get(k) for k in ['category','season','festival','month','year','search','low_stock']}
    items = get_items(session['uid'], {k:v for k,v in filters.items() if v})
    return jsonify({'items': items, 'count': len(items)})

@inventory_bp.route('/add', methods=['POST'])
@login_required
def add():
    d = request.get_json() or {}
    for f in ['product_name','category','cost_price','selling_price']:
        if not d.get(f): return jsonify({'error': f'{f} is required'}), 400
    iid = add_item(session['uid'], d)
    return jsonify({'message': 'Product added', 'id': iid}), 201

@inventory_bp.route('/<int:iid>', methods=['GET'])
@login_required
def get_one(iid):
    item = get_item(session['uid'], iid)
    if not item: return jsonify({'error': 'Not found'}), 404
    return jsonify({'item': item})

@inventory_bp.route('/<int:iid>', methods=['PUT'])
@login_required
def update(iid):
    ok = update_item(session['uid'], iid, request.get_json() or {})
    if not ok: return jsonify({'error': 'Not found'}), 404
    return jsonify({'message': 'Updated'})

@inventory_bp.route('/<int:iid>', methods=['DELETE'])
@login_required
def delete(iid):
    try:
        delete_item(session['uid'], iid)
        return jsonify({'message': 'Deleted', 'id': iid}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@inventory_bp.route('/delete-all', methods=['DELETE'])
@login_required
def delete_all():
    try:
        from backend.models.database import get_db
        conn = get_db()
        conn.execute("DELETE FROM inventory WHERE user_id=?", (session['uid'],))
        conn.commit(); conn.close()
        return jsonify({'message': 'All items deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@inventory_bp.route('/upload-csv', methods=['POST'])
@login_required
def upload_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    f = request.files['file']
    if not f.filename.endswith('.csv'):
        return jsonify({'error': 'CSV only'}), 400
    try:
        df = pd.read_csv(f)
        df.columns = [c.strip().lower().replace(' ','_') for c in df.columns]
        COL_MAP = {
            'product':'product_name','name':'product_name','item':'product_name',
            'cost':'cost_price','buy_price':'cost_price','purchase_price':'cost_price',
            'price':'selling_price','sell_price':'selling_price','mrp':'selling_price',
            'qty':'units_sold','quantity':'units_sold','qty_sold':'units_sold',
            'stock':'current_stock','inventory':'current_stock',
            'margin':'margin_pct','margin_%':'margin_pct',
            'discount':'discount_pct','disc':'discount_pct',
        }
        df.rename(columns=COL_MAP, inplace=True)
        required = ['product_name','category','cost_price','selling_price']
        missing = [c for c in required if c not in df.columns]
        if missing:
            return jsonify({'error': f'Missing columns: {missing}', 'your_columns': list(df.columns)}), 400
        added = 0; errors = []
        for _, row in df.iterrows():
            try:
                d = {k: (None if pd.isna(v) else v) for k,v in row.to_dict().items()}
                d['product_name'] = str(d.get('product_name',''))
                d['category'] = str(d.get('category','Grocery'))
                if not d['product_name']: continue
                add_item(session['uid'], d); added += 1
            except Exception as e:
                errors.append(str(e))
        msg = f" Imported {added} products"
        if errors: msg += f" ({len(errors)} errors)"
        add_notification(session['uid'], "📤 CSV Import Complete", msg, "success")
        return jsonify({'message': msg, 'added': added, 'errors': errors[:3]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@inventory_bp.route('/filters', methods=['GET'])
@login_required
def get_filters():
    from backend.models.database import get_db
    conn = get_db(); uid = session['uid']
    cats = [r[0] for r in conn.execute("SELECT DISTINCT category FROM inventory WHERE user_id=?", (uid,)).fetchall()]
    conn.close()
    return jsonify({'categories': sorted(cats), 'seasons': SEASONS, 'festivals': FESTIVALS,
                    'all_categories': CATEGORIES})

@inventory_bp.route('/template', methods=['GET'])
def template():
    from flask import Response
    csv = ("product_name,category,cost_price,selling_price,units_sold,current_stock,"
           "reorder_level,lead_time_days,discount_pct,supplier_reliability,season,festival,region,date\n"
           "Basmati Rice 5kg,Grocery,180,225,45,200,50,3,0,0.9,Winter,None,North,2024-01-15\n"
           "Gulal Colors,FMCG,35,75,300,100,50,2,10,0.85,Summer,Holi,North,2024-03-08\n"
           "Diwali Diya Set,FMCG,48,95,500,200,100,2,0,0.9,Autumn,Diwali,North,2024-10-24\n"
           "Smartphone Redmi,Electronics,8500,10999,10,25,5,7,5,0.95,None,None,National,2024-06-01\n"
           "Kurta Women,Fashion,280,549,60,80,20,5,0,0.88,Autumn,Navratri,West,2024-09-15\n")
    return Response(csv, mimetype='text/csv',
                    headers={"Content-Disposition": "attachment; filename=foresight_template.csv"})