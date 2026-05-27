"""
ForeSight - Advanced ML Predictor
Handles: sales, profit, revenue, demand level, reorder qty, stockout prevention
"""
import joblib, json, os, numpy as np
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
ML  = os.path.join(BASE, 'ml_models')

_cache = {}

def _load():
    global _cache
    if _cache: return _cache
    try:
        _cache = {
            'sales':   joblib.load(os.path.join(ML, 'sales_model.pkl')),
            'profit':  joblib.load(os.path.join(ML, 'profit_model.pkl')),
            'revenue': joblib.load(os.path.join(ML, 'revenue_model.pkl')),
            'demand':  joblib.load(os.path.join(ML, 'demand_clf.pkl')),
            'encoders':joblib.load(os.path.join(ML, 'label_encoders.pkl')),
            'features':joblib.load(os.path.join(ML, 'feature_cols.pkl')),
        }
        with open(os.path.join(ML, 'metadata.json')) as f:
            _cache['meta'] = json.load(f)
        print("✅ ML models loaded")
    except Exception as e:
        print(f"⚠️ ML load error: {e}")
        _cache = None
    return _cache

def _encode(encoders, col, val):
    if col not in encoders: return 0
    le = encoders[col]
    val = str(val)
    if val in le.classes_:
        return int(le.transform([val])[0])
    return len(le.classes_)   # unknown → out-of-range (handled by tree models)

def _build_vector(d, models):
    enc = models['encoders']
    month = int(d.get('month', datetime.now().month))
    year  = int(d.get('year',  datetime.now().year))
    cost  = float(d.get('cost_price', d.get('Cost_Price', 100)))
    sell  = float(d.get('selling_price', d.get('Selling_Price', 150)))
    disc  = float(d.get('discount_pct', d.get('Discount_%', 0)))
    stock = int(d.get('current_stock', d.get('Current_Stock', 50)))
    reorder=int(d.get('reorder_level', d.get('Reorder_Level', 10)))
    lead  = int(d.get('lead_time_days', d.get('Lead_Time_Days', 3)))
    hold  = float(d.get('holding_cost', d.get('Holding_Cost_Per_Unit', cost*0.02)))
    supp  = float(d.get('supplier_reliability', d.get('Supplier_Reliability', 0.9)))
    dow   = int(d.get('day_of_week', datetime.now().weekday()))
    day   = int(d.get('day', datetime.now().day))
    week  = int(d.get('week', datetime.now().isocalendar()[1]))
    is_weekend = 1 if dow >= 5 else 0
    festival = d.get('festival', d.get('Festival', 'None')) or 'None'
    is_festival = 0 if festival == 'None' else 1
    quarter = (month - 1) // 3 + 1
    price_ratio = sell / max(cost, 1)
    stock_buffer = stock - reorder

    feat_map = {
        'Day_of_Week': dow, 'Month': month, 'Week': week, 'Year': year,
        'Day': day, 'Quarter': quarter,
        'Season_enc':   _encode(enc, 'Season',   d.get('season', d.get('Season', 'None'))),
        'Festival_enc': _encode(enc, 'Festival', festival),
        'Category_enc': _encode(enc, 'Category', d.get('category', d.get('Category', 'Grocery'))),
        'Product_enc':  _encode(enc, 'Product',  d.get('product_name', d.get('Product', 'Unknown'))),
        'Cost_Price': cost, 'Selling_Price': sell, 'Margin_%': round((sell-cost)/max(cost,1)*100,2),
        'Discount_%': disc, 'Current_Stock': stock, 'Reorder_Level': reorder,
        'Lead_Time_Days': lead, 'Holding_Cost_Per_Unit': hold,
        'Supplier_Reliability': supp,
        'Is_Weekend': is_weekend, 'Is_Festival': is_festival,
        'Price_Ratio': price_ratio, 'Stock_Buffer': stock_buffer,
    }
    return [feat_map.get(c, 0) for c in models['features']]

def _demand_label(units, meta):
    thr = meta.get('demand_thresholds', {'low': 30, 'high': 80})
    if units <= thr['low']:   return 'Low',    '🔴', 'danger'
    if units <= thr['high']:  return 'Medium', '🟡', 'warning'
    return 'High', '🟢', 'success'

def _reorder_qty(pred_units, current_stock, reorder_level, lead_time, supplier_rel):
    """Sophisticated reorder quantity calculation"""
    safety_stock = int(pred_units * lead_time * (1 - supplier_rel) * 1.5)
    if current_stock > reorder_level + safety_stock:
        return 0, "✅ Sufficient stock"
    target = pred_units * (lead_time + 7) + safety_stock   # cover lead time + 7 days
    qty = max(0, int(target - current_stock))
    return qty, f"Order {qty} units (covers {lead_time + 7} days + safety stock)"

def predict_all(d, user_data_df=None):
    """
    Master prediction function — returns full analysis
    Handles unknown products via category-level fallback
    """
    models = _load()
    meta   = models['meta'] if models else {}

    cost   = float(d.get('cost_price', 100))
    sell   = float(d.get('selling_price', 150))
    disc   = float(d.get('discount_pct', 0))
    stock  = int(d.get('current_stock', 50))
    reorder= int(d.get('reorder_level', 10))
    lead   = int(d.get('lead_time_days', 3))
    supp   = float(d.get('supplier_reliability', 0.9))
    cat    = d.get('category', 'Grocery')
    product= d.get('product_name', 'Unknown')
    festival=d.get('festival', 'None') or 'None'
    season  =d.get('season', 'None') or 'None'
    month   = int(d.get('month', datetime.now().month))
    eff_sell = sell * (1 - disc/100)
    margin   = round((sell-cost)/max(cost,1)*100, 2)

    # ── Unknown product handling ──────────────────────────────────
    is_unknown = product not in meta.get('products', [])
    if is_unknown:
        cat_stats = meta.get('cat_stats', {})
        avg_units = cat_stats.get('avg_units', {}).get(cat, 40)
        confidence = 55
    else:
        avg_units = None
        confidence = 78

    if models:
        import pandas as pd
        X = pd.DataFrame([_build_vector(d, models)], columns=models["features"])
        pred_units   = max(1, int(round(models['sales'].predict(X)[0])))
        pred_profit  = float(models['profit'].predict(X)[0])
        pred_revenue = float(models['revenue'].predict(X)[0])
        try:
            demand_pred = models['demand'].predict(X)[0]
            demand_prob = models['demand'].predict_proba(X)[0]
        except:
            demand_pred = 'Medium'; demand_prob = [0.2, 0.6, 0.2]

        # festival / season boost overtride for unknown products
        if is_unknown and avg_units:
            fest_stats = meta.get('fest_stats', {})
            mult = 1.0
            if festival != 'None' and festival in fest_stats.get('avg_units', {}):
                overall_avg = sum(meta.get('cat_stats',{}).get('avg_units',{}).values()) / max(len(meta.get('cat_stats',{}).get('avg_units',{})),1)
                mult = fest_stats['avg_units'][festival] / max(overall_avg, 1)
            pred_units = max(1, int(avg_units * mult))
            pred_revenue = pred_units * eff_sell
            pred_profit  = pred_revenue - pred_units * cost
    else:
        # Rule-based fallback
        base = avg_units or 40
        mult = 1.0
        festival_mult = {'Diwali':3.0,'Holi':2.8,'Navratri':2.5,'Dussehra':2.2,'Eid':2.0,'Raksha Bandhan':2.0,'Christmas':1.8,'None':1.0}
        season_mult  = {'Summer':1.3,'Winter':1.2,'Rainy':1.1,'Autumn':1.15,'None':1.0}
        mult = festival_mult.get(festival,1.0) * season_mult.get(season,1.0)
        pred_units   = max(1, int(base * mult))
        pred_revenue = pred_units * eff_sell
        pred_profit  = pred_revenue - pred_units * cost
        demand_pred  = 'Medium'
        demand_prob  = [0.2,0.6,0.2]
        confidence   = 50

    demand_label, demand_icon, demand_class = _demand_label(pred_units, meta)
    reorder_qty, reorder_msg = _reorder_qty(pred_units, stock, reorder, lead, supp)
    days_cover  = int(stock / max(pred_units/30, 1))
    stockout_risk = "🔴 HIGH" if days_cover < lead else ("🟡 MEDIUM" if days_cover < lead*2 else "🟢 LOW")
    overstock_risk = "⚠️ YES" if stock > pred_units * 3 else "✅ NO"

    result = {
        'product_name':    product,
        'category':        cat,
        'is_unknown':      is_unknown,
        'confidence':      confidence,
        'predicted_units': pred_units,
        'predicted_revenue': round(max(0, pred_revenue), 2),
        'predicted_profit':  round(pred_profit, 2),
        'margin_pct':        margin,
        'effective_price':   round(eff_sell, 2),
        'demand_level':      demand_label,
        'demand_icon':       demand_icon,
        'demand_class':      demand_class,
        'demand_proba': {
            'Low':    round(float(demand_prob[0])*100, 1) if len(demand_prob)>0 else 20,
            'Medium': round(float(demand_prob[1])*100, 1) if len(demand_prob)>1 else 60,
            'High':   round(float(demand_prob[2])*100, 1) if len(demand_prob)>2 else 20,
        },
        'reorder_qty':     reorder_qty,
        'reorder_msg':     reorder_msg,
        'days_of_stock':   days_cover,
        'stockout_risk':   stockout_risk,
        'overstock_risk':  overstock_risk,
        'safety_stock':    int(pred_units * lead * (1-supp) * 1.5),
        'investment_needed': round(reorder_qty * cost, 2),
        'roi_pct':         round((pred_profit / max(pred_units*cost, 1))*100, 1),
        'festival':        festival,
        'season':          season,
        'month':           month,
        'model_used':      'XGBoost + RandomForest',
        'note':            '⚠️ Unknown product — using category-level estimate' if is_unknown else '✅ Product recognized in training data',
    }
    return result


def predict_sales_only(d):
    result = predict_all(d)
    return {k: result[k] for k in ['predicted_units','demand_level','demand_icon','demand_class',
                                    'confidence','stockout_risk','note','is_unknown']}


def budget_allocation(budget, products):
    """Allocate budget across products by ROI"""
    results = []
    for p in products:
        r = predict_all(p)
        cost = float(p.get('cost_price', 100))
        rec_qty = r['reorder_qty'] or max(1, r['predicted_units'])
        cost_needed = rec_qty * cost
        r.update({'rec_qty': rec_qty, 'cost_needed': cost_needed,
                  'product_name': p.get('product_name','?')})
        results.append(r)

    results.sort(key=lambda x: x.get('roi_pct', 0), reverse=True)
    allocated = []; remaining = budget
    for r in results:
        if remaining <= 0: break
        cost = float(r.get('cost_price', 100)) if 'cost_price' not in r else float(r.get('cost_price',100))
        # get from original product list
        for p in products:
            if p.get('product_name') == r['product_name']:
                cost = float(p.get('cost_price', 100))
        affordable = min(r['rec_qty'], int(remaining / max(cost, 1)))
        if affordable > 0:
            total_cost = affordable * cost
            r['allocated_qty'] = affordable
            r['allocated_cost'] = round(total_cost, 2)
            r['allocated_profit'] = round(r['predicted_profit'] / max(r['predicted_units'],1) * affordable, 2)
            remaining -= total_cost
            allocated.append(r)

    return {
        'total_budget': budget,
        'allocated': round(budget - remaining, 2),
        'remaining': round(remaining, 2),
        'total_expected_profit': round(sum(a['allocated_profit'] for a in allocated), 2),
        'overall_roi': round(sum(a['allocated_profit'] for a in allocated) / max(budget-remaining,1)*100, 1),
        'products': allocated,
    }


def retrain_with_user_data(df_user):
    """Incremental learning with user's own data"""
    import pandas as pd
    if len(df_user) < 20:
        return False, f"Need ≥20 records (you have {len(df_user)})"
    try:
        import xgboost as xgb
        from sklearn.preprocessing import LabelEncoder

        df = df_user.copy()
        for col in ['season','festival','category','product_name']:
            if col not in df.columns: df[col] = 'None'
        df['Is_Weekend'] = 0; df['Is_Festival'] = (df.get('festival','None') != 'None').astype(int)
        df['Quarter'] = ((df.get('month', 1) - 1) // 3 + 1).clip(1,4)
        df['Price_Ratio'] = df['selling_price'] / df['cost_price'].clip(lower=1)
        df['Stock_Buffer'] = df.get('current_stock', 50) - df.get('reorder_level', 10)

        le_dict = {}
        for col in ['season','festival','category','product_name']:
            le = LabelEncoder()
            df[f'{col}_enc'] = le.fit_transform(df[col].astype(str).fillna('None'))
            le_dict[col.replace('product_name','Product').replace('season','Season')
                       .replace('festival','Festival').replace('category','Category')] = le

        feature_cols = ['Day_of_Week','Month','Week','Year','Day','Quarter',
            'Season_enc','Festival_enc','Category_enc','product_name_enc',
            'cost_price','selling_price','Margin_%','discount_pct',
            'current_stock','reorder_level','lead_time_days',
            'holding_cost','supplier_reliability',
            'Is_Weekend','Is_Festival','Price_Ratio','Stock_Buffer']
        feature_cols_mapped = [c for c in feature_cols if c in df.columns]
        X = df[feature_cols_mapped].fillna(0)
        y = df.get('units_sold', df.get('Units_Sold', pd.Series([40]*len(df))))

        model = xgb.XGBRegressor(n_estimators=100, max_depth=5, random_state=42, verbosity=0)
        model.fit(X, y)
        joblib.dump(model, os.path.join(ML, 'sales_model_user.pkl'))
        return True, f"✅ Retrained on {len(df)} records"
    except Exception as e:
        return False, str(e)
