from flask import Blueprint, request, jsonify, session
from backend.models.database import create_user, verify_user, get_user, get_all_users, update_user, add_notification
from functools import wraps

auth_bp = Blueprint('auth', __name__)

def login_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if not session.get('uid'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*a, **kw)
    return dec

def admin_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if not session.get('uid'):
            return jsonify({'error': 'Unauthorized'}), 401
        u = get_user(session['uid'])
        if not u or u.get('role') != 'admin':
            return jsonify({'error': 'Admin only'}), 403
        return f(*a, **kw)
    return dec

@auth_bp.route('/register', methods=['POST'])
def register():
    d = request.get_json() or {}
    for f in ['username','email','password']:
        if not d.get(f): return jsonify({'error': f'{f} is required'}), 400
    if len(d['password']) < 6:
        return jsonify({'error': 'Password must be ≥6 characters'}), 400
    ok, msg = create_user(d['username'], d['email'], d['password'],
                          d.get('shop_name', f"{d['username']}'s Shop"),
                          d.get('business_type', 'Retail'))
    if not ok: return jsonify({'error': msg}), 400
    u = verify_user(d['email'], d['password'])
    session['uid'] = u['id']
    add_notification(u['id'], "🎉 Welcome to ForeSight!", "Your AI-powered inventory system is ready. Add your first product or upload a CSV.", "success")
    return jsonify({'user': _safe(u)}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    d = request.get_json() or {}
    u = verify_user(d.get('email',''), d.get('password',''))
    if not u: return jsonify({'error': 'Invalid email or password'}), 401
    session['uid'] = u['id']
    return jsonify({'user': _safe(u)})

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})

@auth_bp.route('/me', methods=['GET'])
@login_required
def me():
    u = get_user(session['uid'])
    return jsonify({'user': _safe(u)})

@auth_bp.route('/check', methods=['GET'])
def check():
    return jsonify({'ok': bool(session.get('uid')), 'uid': session.get('uid')})

@auth_bp.route('/update', methods=['PUT'])
@login_required
def update():
    update_user(session['uid'], request.get_json() or {})
    return jsonify({'message': 'Profile updated'})

@auth_bp.route('/admin/users', methods=['GET'])
@admin_required
def admin_users():
    return jsonify({'users': get_all_users()})

def _safe(u):
    if not u: return {}
    return {k: u[k] for k in ['id','username','email','shop_name','business_type','role','avatar_color','created_at'] if k in u}
