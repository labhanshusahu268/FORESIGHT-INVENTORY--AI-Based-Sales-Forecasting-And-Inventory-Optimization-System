from flask import Blueprint, request, jsonify, session
from backend.routes.auth import login_required
from backend.utils.predictor import predict_all, budget_allocation, retrain_with_user_data
from backend.models.database import log_prediction, get_prediction_history, get_items, add_notification
import pandas as pd

predictions_bp = Blueprint('predictions', __name__)

@predictions_bp.route('/analyze', methods=['POST'])
@login_required
def analyze():
    d = request.get_json() or {}
    result = predict_all(d)
    log_prediction(session['uid'], 'full_analysis', d, result)
    return jsonify({'success': True, 'result': result})

@predictions_bp.route('/sales', methods=['POST'])
@login_required
def sales():
    d = request.get_json() or {}
    result = predict_all(d)
    log_prediction(session['uid'], 'sales', d, result)
    return jsonify({'success': True, 'result': result})

@predictions_bp.route('/budget', methods=['POST'])
@login_required
def budget():
    d = request.get_json() or {}
    budget_amt = float(d.get('budget', 0))
    if budget_amt <= 0:
        return jsonify({'error': 'Budget must be > 0'}), 400
    products = d.get('products', [])
    if not products:
        items = get_items(session['uid'])
        if not items:
            return jsonify({'error': 'No products found. Add inventory first.'}), 400
        seen = set()
        for item in items:
            if item['product_name'] not in seen:
                seen.add(item['product_name'])
                products.append({
                    'product_name': item['product_name'],
                    'category': item['category'],
                    'cost_price': item['cost_price'],
                    'selling_price': item['selling_price'],
                    'current_stock': item['current_stock'],
                    'reorder_level': item['reorder_level'],
                    'lead_time_days': item['lead_time_days'],
                    'supplier_reliability': item.get('supplier_reliability', 0.9),
                    'discount_pct': item.get('discount_pct', 0),
                    'season': d.get('season', 'None'),
                    'festival': d.get('festival', 'None'),
                    'month': d.get('month', 6),
                })
    result = budget_allocation(budget_amt, products)
    log_prediction(session['uid'], 'budget', d, result)
    return jsonify({'success': True, 'result': result})

@predictions_bp.route('/retrain', methods=['POST'])
@login_required
def retrain():
    items = get_items(session['uid'])
    if not items:
        return jsonify({'error': 'No inventory data to train on'}), 400
    df = pd.DataFrame(items)
    ok, msg = retrain_with_user_data(df)
    if ok:
        add_notification(session['uid'], " Models Retrained", msg, "success")
    return jsonify({'success': ok, 'message': msg})

@predictions_bp.route('/history', methods=['GET'])
@login_required
def history():
    h = get_prediction_history(session['uid'])
    return jsonify({'history': h})

@predictions_bp.route('/metadata', methods=['GET'])
def metadata():
    import json, os
    try:
        with open(os.path.join('ml_models','metadata.json')) as f:
            meta = json.load(f)
        return jsonify(meta)
    except:
        return jsonify({
            'categories': ['FMCG','Electronics','Fashion','Grocery','Stationery','Agriculture'],
            'seasons': ['Summer','Winter','Rainy','Autumn'],
            'festivals': ['None','Diwali','Holi','Eid','Christmas','Navratri','Dussehra','Raksha Bandhan'],
            'products': []
        })
