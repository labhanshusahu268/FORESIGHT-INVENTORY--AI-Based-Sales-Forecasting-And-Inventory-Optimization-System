"""
ForeSight Inventory - Main Flask Application
Production-grade AI-powered Inventory Management System
"""
from flask import Flask, send_from_directory, session
from flask_cors import CORS
import os

def create_app():
    app = Flask(
        __name__,
        template_folder='frontend/templates',
        static_folder='frontend/static'
    )

    app.config.update(
        SECRET_KEY='foresight_ultra_secret_2024_#$@!',
        UPLOAD_FOLDER='data/uploads',
        EXPORT_FOLDER='data/exports',
        MAX_CONTENT_LENGTH=32 * 1024 * 1024,  # 32MB
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
    )

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)

    CORS(app, supports_credentials=True, origins=['http://localhost:5000'])

    # Register blueprints
    from backend.routes.auth       import auth_bp
    from backend.routes.inventory  import inventory_bp
    from backend.routes.predictions import predictions_bp
    from backend.routes.dashboard  import dashboard_bp
    from backend.routes.reports    import reports_bp
    from backend.routes.settings   import settings_bp
    from backend.routes.notifications import notif_bp

    app.register_blueprint(auth_bp,        url_prefix='/api/auth')
    app.register_blueprint(inventory_bp,   url_prefix='/api/inventory')
    app.register_blueprint(predictions_bp, url_prefix='/api/predict')
    app.register_blueprint(dashboard_bp,   url_prefix='/api/dashboard')
    app.register_blueprint(reports_bp,     url_prefix='/api/reports')
    app.register_blueprint(settings_bp,    url_prefix='/api/settings')
    app.register_blueprint(notif_bp,       url_prefix='/api/notifications')

    # Page routes
    @app.route('/')
    def landing():
        return send_from_directory('frontend/templates', 'landing.html')

    @app.route('/login')
    def login_page():
        return send_from_directory('frontend/templates', 'auth.html')

    @app.route('/dashboard')
    def dashboard():
        return send_from_directory('frontend/templates', 'dashboard.html')

    @app.route('/inventory')
    def inventory():
        return send_from_directory('frontend/templates', 'inventory.html')

    @app.route('/predict')
    def predict():
        return send_from_directory('frontend/templates', 'predict.html')

    @app.route('/reports')
    def reports():
        return send_from_directory('frontend/templates', 'reports.html')

    @app.route('/settings')
    def settings():
        return send_from_directory('frontend/templates', 'settings.html')

    # Init DB
    from backend.models.database import init_db
    init_db()

    return app


if __name__ == '__main__':
    app = create_app()
    print("\n" + "="*55)
    print("   ForeSight Inventory — AI-Powered System")
    print("   http://localhost:5000")
    print("   Dashboard: http://localhost:5000/dashboard")
    print("="*55 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
