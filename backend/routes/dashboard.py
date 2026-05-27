from flask import Blueprint, jsonify, session, request, Response, current_app
from backend.routes.auth import login_required
from backend.models.database import get_stats, get_db, get_settings, save_settings, get_notifications, mark_read, add_notification, get_prediction_history
import json, os, io
from datetime import datetime

dashboard_bp  = Blueprint('dashboard',  __name__)
reports_bp    = Blueprint('reports',    __name__)
settings_bp   = Blueprint('settings',   __name__)
notif_bp      = Blueprint('notifications', __name__)


# ═══════════════════════════════ DASHBOARD ═══════════════════════════════

@dashboard_bp.route('/stats', methods=['GET'])
@login_required
def stats():
    return jsonify(get_stats(session['uid']))

@dashboard_bp.route('/trend', methods=['GET'])
@login_required
def trend():
    conn = get_db(); uid = session['uid']
    data = conn.execute("""
        SELECT year,month,SUM(revenue) revenue,SUM(profit) profit,
               SUM(units_sold) units,COUNT(DISTINCT product_name) products
        FROM inventory WHERE user_id=?
        GROUP BY year,month ORDER BY year,month
    """, (uid,)).fetchall()
    conn.close()
    return jsonify({'trend': [dict(r) for r in data]})

@dashboard_bp.route('/category-trends', methods=['GET'])
@login_required
def cat_trends():
    conn = get_db(); uid = session['uid']
    data = conn.execute("""
        SELECT category,month,year,SUM(units_sold) units,SUM(profit) profit
        FROM inventory WHERE user_id=?
        GROUP BY category,year,month ORDER BY category,year,month
    """, (uid,)).fetchall()
    conn.close()
    return jsonify({'data': [dict(r) for r in data]})

@dashboard_bp.route('/seasonal-trends', methods=['GET'])
@login_required
def seasonal():
    conn = get_db(); uid = session['uid']
    data = conn.execute("""
        SELECT season,category,SUM(units_sold) units,SUM(profit) profit,SUM(revenue) revenue
        FROM inventory WHERE user_id=? AND season!='None'
        GROUP BY season,category ORDER BY season,profit DESC
    """, (uid,)).fetchall()
    conn.close()
    return jsonify({'data': [dict(r) for r in data]})

@dashboard_bp.route('/festival-trends', methods=['GET'])
@login_required
def festival_trends():
    conn = get_db(); uid = session['uid']
    data = conn.execute("""
        SELECT festival,SUM(units_sold) units,SUM(profit) profit,SUM(revenue) revenue,
               COUNT(DISTINCT category) categories
        FROM inventory WHERE user_id=? AND festival!='None'
        GROUP BY festival ORDER BY profit DESC
    """, (uid,)).fetchall()
    conn.close()
    return jsonify({'data': [dict(r) for r in data]})


# ═══════════════════════════════ REPORTS ═════════════════════════════════

@reports_bp.route('/summary', methods=['GET'])
@login_required
def report_summary():
    stats = get_stats(session['uid'])
    history = get_prediction_history(session['uid'], 50)
    return jsonify({'stats': stats, 'prediction_history': history})

@reports_bp.route('/export-pdf', methods=['POST'])
@login_required
def export_pdf():
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        uid  = session['uid']
        data = get_stats(uid)
        s    = data['summary']

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm,
                                 leftMargin=2*cm, rightMargin=2*cm)
        styles = getSampleStyleSheet()
        story  = []

        # Header
        title_style = ParagraphStyle('title', fontSize=22, fontName='Helvetica-Bold',
                                      spaceAfter=6, textColor=colors.HexColor('#6c63ff'), alignment=TA_CENTER)
        sub_style   = ParagraphStyle('sub', fontSize=11, fontName='Helvetica',
                                      spaceAfter=20, textColor=colors.grey, alignment=TA_CENTER)
        story.append(Paragraph("🔮 ForeSight Inventory Report", title_style))
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y, %I:%M %p')}", sub_style))
        story.append(Spacer(1, 0.4*cm))

        # Summary
        h2 = ParagraphStyle('h2', fontSize=14, fontName='Helvetica-Bold', spaceAfter=8, spaceBefore=12,
                              textColor=colors.HexColor('#1a1d26'))
        story.append(Paragraph("Executive Summary", h2))
        summary_data = [
            ['Metric', 'Value'],
            ['Total Products',   str(s.get('total_products', 0))],
            ['Total Revenue',    f"₹{s.get('total_revenue',0):,.0f}"],
            ['Total Profit',     f"₹{s.get('total_profit',0):,.0f}"],
            ['Avg Margin',       f"{s.get('avg_margin',0):.1f}%"],
            ['Units Sold',       str(s.get('total_units',0))],
            ['Low Stock Items',  str(s.get('low_stock_count',0))],
            ['Total Investment', f"₹{s.get('total_investment',0):,.0f}"],
        ]
        t = Table(summary_data, colWidths=[8*cm, 8*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#6c63ff')),
            ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
            ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',   (0,0), (-1,-1), 10),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8f9ff')]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e0e0e0')),
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
            ('PADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(t); story.append(Spacer(1, 0.5*cm))

        # Top products
        if data.get('top_products'):
            story.append(Paragraph("Top Products by Profit", h2))
            ph = [['#','Product','Category','Units','Revenue','Profit','Margin']]
            for i, p in enumerate(data['top_products'][:10], 1):
                ph.append([str(i), p['product_name'][:25], p['category'],
                            str(p['units']), f"₹{p['revenue']:,.0f}",
                            f"₹{p['profit']:,.0f}", f"{p['margin']:.1f}%"])
            tp = Table(ph, colWidths=[0.8*cm,5.5*cm,2.5*cm,1.8*cm,2.5*cm,2.5*cm,1.8*cm])
            tp.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#111318')),
                ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
                ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE',   (0,0), (-1,-1), 8),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f5f5ff')]),
                ('GRID', (0,0), (-1,-1), 0.3, colors.lightgrey),
                ('ALIGN', (3,0), (-1,-1), 'RIGHT'),
                ('PADDING', (0,0), (-1,-1), 5),
            ]))
            story.append(tp); story.append(Spacer(1, 0.4*cm))

        # Season trends
        if data.get('by_season'):
            story.append(Paragraph("Performance by Season", h2))
            sh = [['Season','Revenue','Profit','Units']]
            for r in data['by_season']:
                sh.append([r['season'], f"₹{r['revenue']:,.0f}", f"₹{r['profit']:,.0f}", str(r['units'])])
            st = Table(sh, colWidths=[4*cm,4.5*cm,4.5*cm,4.5*cm])
            st.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#4ade80')),
                ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE',   (0,0), (-1,-1), 9),
                ('GRID', (0,0), (-1,-1), 0.3, colors.lightgrey),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f0fff4')]),
                ('PADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(st)

        # Footer
        story.append(Spacer(1, 1*cm))
        story.append(Paragraph("ForeSight Inventory — AI-Powered Intelligence", 
                                ParagraphStyle('footer', fontSize=8, textColor=colors.grey, alignment=TA_CENTER)))

        doc.build(story)
        buf.seek(0)
        return Response(buf.read(), mimetype='application/pdf',
                        headers={'Content-Disposition': f'attachment; filename=foresight_report_{datetime.now().strftime("%Y%m%d")}.pdf'})
    except ImportError:
        return jsonify({'error': 'reportlab not installed. Run: pip install reportlab'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/export-csv', methods=['GET'])
@login_required
def export_csv():
    from backend.models.database import get_items
    items = get_items(session['uid'])
    if not items:
        return jsonify({'error': 'No data to export'}), 400
    import csv
    buf = io.StringIO()
    if items:
        w = csv.DictWriter(buf, fieldnames=items[0].keys())
        w.writeheader(); w.writerows(items)
    return Response(buf.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': f'attachment; filename=inventory_{datetime.now().strftime("%Y%m%d")}.csv'})


# ═══════════════════════════════ SETTINGS ════════════════════════════════

@settings_bp.route('/', methods=['GET'])
@login_required
def get_s():
    return jsonify(get_settings(session['uid']))

@settings_bp.route('/', methods=['PUT'])
@login_required
def save_s():
    save_settings(session['uid'], request.get_json() or {})
    return jsonify({'message': 'Settings saved'})

@settings_bp.route('/change-password', methods=['POST'])
@login_required
def change_pw():
    from backend.models.database import get_db, _hash
    d = request.get_json() or {}
    if not d.get('old_password') or not d.get('new_password'):
        return jsonify({'error': 'Both passwords required'}), 400
    if len(d['new_password']) < 6:
        return jsonify({'error': 'Password must be ≥6 characters'}), 400
    conn = get_db()
    uid  = session['uid']
    from backend.models.database import verify_user, get_user
    u    = get_user(uid)
    conn.close()
    if not verify_user(u['email'], d['old_password']):
        return jsonify({'error': 'Incorrect current password'}), 401
    conn = get_db()
    import hashlib
    conn.execute("UPDATE users SET password=? WHERE id=?",
                 (hashlib.sha256(d['new_password'].encode()).hexdigest(), uid))
    conn.commit(); conn.close()
    return jsonify({'message': 'Password changed'})


# ═══════════════════════════════ NOTIFICATIONS ═══════════════════════════

@notif_bp.route('/', methods=['GET'])
@login_required
def get_notifs():
    unread = request.args.get('unread') == '1'
    return jsonify({'notifications': get_notifications(session['uid'], unread),
                    'unread_count': len(get_notifications(session['uid'], True))})

@notif_bp.route('/read/<int:nid>', methods=['POST'])
@login_required
def read_one(nid):
    mark_read(session['uid'], nid); return jsonify({'message': 'ok'})

@notif_bp.route('/read-all', methods=['POST'])
@login_required
def read_all():
    mark_read(session['uid']); return jsonify({'message': 'ok'})
