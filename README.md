<<<<<<< HEAD
#  ForeSight Inventory — AI-Powered Smart Inventory Management

> Production-grade AI inventory system for Indian retailers, wholesalers, and shopkeepers.

---

##  Quick Start (3 Steps)

### Step 1: Install Dependencies
```bash
cd foresight2
pip install -r requirements.txt
```

### Step 2: (Optional) Retrain ML Models
ML models are pre-trained and included. Skip this step to run immediately.
```bash
pip install jupyter notebook matplotlib seaborn
cd notebooks
jupyter notebook model_training.ipynb
# Run all cells in order
```

### Step 3: Start the Server
```bash
python app.py
```

Open your browser: **http://localhost:5000**

---

##  Demo Account
- **Email:** `demo@foresight.ai`
- **Password:** `demo@123`

Or click **"Demo Account — One Click"** on the login page.

---

##  Project Structure

```
foresight2/
├── app.py                          ← Flask entry point
├── requirements.txt
├── README.md
│
├── backend/
│   ├── models/
│   │   └── database.py             ← SQLite DB (users, inventory, predictions, notifications)
│   ├── routes/
│   │   ├── auth.py                 ← Login, Register, Logout, Admin
│   │   ├── inventory.py            ← CRUD + CSV Upload
│   │   ├── predictions.py          ← Sales, Profit, Budget, Retrain
│   │   ├── dashboard.py            ← Stats, Trends, Season, Festival
│   │   ├── reports.py              ← PDF Export, CSV Export
│   │   ├── settings.py             ← User Preferences
│   │   └── notifications.py        ← In-app notifications
│   └── utils/
│       └── predictor.py            ← ML engine (XGBoost + RandomForest)
│
├── frontend/
│   ├── templates/
│   │   ├── landing.html            ← Marketing landing page
│   │   ├── auth.html               ← Login + Register
│   │   ├── dashboard.html          ← Main analytics dashboard
│   │   ├── inventory.html          ← Product management
│   │   ├── predict.html            ← AI prediction tools
│   │   ├── reports.html            ← Charts + PDF/CSV export
│   │   └── settings.html           ← Account + preferences
│   └── static/
│       ├── css/main.css            ← Premium dark glassmorphism design
│       └── js/
│           ├── main.js             ← Auth, toast, notifications, utils
│           ├── dashboard.js        ← Dashboard charts
│           ├── inventory.js        ← Inventory CRUD + CSV upload
│           ├── predict.js          ← Prediction UI
│           └── reports.js          ← Reports charts + exports
│
├── ml_models/                      ← Pre-trained models (ready to use)
│   ├── sales_model.pkl             ← XGBoost sales predictor
│   ├── profit_model.pkl            ← XGBoost profit predictor
│   ├── revenue_model.pkl           ← XGBoost revenue predictor
│   ├── demand_clf.pkl              ← RandomForest demand classifier
│   ├── label_encoders.pkl          ← Category/festival/season encoders
│   ├── feature_cols.pkl            ← 23 ML feature columns
│   └── metadata.json               ← Categories, festivals, model metrics
│
├── notebooks/
│   └── model_training.ipynb        ← Full ML training pipeline
│
└── data/
    ├── inventory_dataset.csv       ← 6000+ row training dataset
    ├── inventory_cleaned.csv       ← Cleaned dataset
    └── uploads/                    ← User CSV uploads (auto-created)
```

---

##  Full Feature List

###  AI / ML Features
- **Sales Prediction** — XGBoost with 23 features predicts monthly units sold
- **Profit Forecasting** — Predict revenue, profit, and ROI before investing
- **Demand Classification** — High / Medium / Low demand with probability bars
- **Smart Reorder** — Auto-calculate reorder qty with lead time + safety stock
- **Stockout Prevention** — Days of stock countdown + risk levels
- **Overstock Detection** — Alerts when stock is 3x+ predicted demand
- **Budget Planner** — Allocate budget across products by ROI ranking
- **Unknown Product Handling** — Falls back to category-level estimates
- **Model Retraining** — Retrain on your own data when you have 20+ records

###  Dashboard
- 6 KPI stat cards (Revenue, Profit, Margin, Units, Products, Low Stock)
- Monthly revenue & profit trend chart (bar + line combo)
- Category revenue breakdown (doughnut chart)
- Seasonal performance radar chart
- Indian festival impact bar chart (horizontal)
- Top 10 products table ranked by profit
- Low stock alerts with progress bars

###  Inventory Management
- Full CRUD (Add, Edit, Delete)
- SKU auto-generation
- Live margin preview while typing
- Filters: Category, Season, Festival, Month + search
- Low Stock Only filter
- CSV bulk import with column auto-mapping
- Download CSV template

###  Reports
- **PDF Export** — Professional report with summary, top products, season trends
- **CSV Export** — Full inventory data download
- **AI Insights** — Auto-generated business analysis
- Sales trend chart
- Category breakdown chart
- Seasonal trends bar chart
- Festival impact (dual-axis chart)
- Category trends over time (multi-line)

###  Indian Festival & Season Intelligence
25+ festivals: Diwali, Holi, Eid, Christmas, Navratri, Dussehra, Raksha Bandhan, Janmashtami, Onam, Pongal, Makar Sankranti, Ganesh Chaturthi, Chhath Puja, Baisakhi, Lohri, Maha Shivratri, Basant Panchami, Bihu, Ugadi, Republic Day, Independence Day, Valentine's Day, New Year, Labour Day, Children's Day

4 Seasons: Summer, Winter, Rainy, Autumn

###  Business Categories
FMCG, Electronics, Fashion, Grocery, Stationery, Agriculture

###  Settings
- Profile management (name, shop, business type, avatar color)
- Password change
- Currency preference (INR/USD/EUR)
- Low stock threshold
- Notification toggles
- Model retrain trigger
- Data delete

###  Auth & Security
- Session-based authentication
- Password hashing (SHA-256)
- Admin mode (set role='admin' in DB)
- In-app notification system
- Per-user data isolation

---

##  CSV Upload Format

**Required columns:**
```
product_name, category, cost_price, selling_price
```

**Optional columns:**
```
units_sold, current_stock, reorder_level, lead_time_days,
discount_pct, supplier_reliability, season, festival,
region, date, sku
```

**Column aliases supported:** `name`, `product`, `item`, `cost`, `buy_price`,
`purchase_price`, `sell_price`, `mrp`, `price`, `qty`, `quantity`, `stock`, `inventory`

---

##  ML Model Details

| Model | Algorithm | Target | Key Features |
|-------|-----------|--------|-------------|
| Sales Predictor | XGBoost (300 trees) | Units_Sold | Festival, Season, Category, Price, Stock |
| Profit Predictor | XGBoost (200 trees) | Profit | All 23 features |
| Revenue Predictor | XGBoost (200 trees) | Revenue | All 23 features |
| Demand Classifier | RandomForest (150 trees) | High/Med/Low | All 23 features |

**23 ML Features Used:**
Day_of_Week, Month, Week, Year, Day, Quarter, Season_enc, Festival_enc, Category_enc, Product_enc, Cost_Price, Selling_Price, Margin_%, Discount_%, Current_Stock, Reorder_Level, Lead_Time_Days, Holding_Cost_Per_Unit, Supplier_Reliability, Is_Weekend, Is_Festival, Price_Ratio, Stock_Buffer

---

##  Troubleshooting

**Port in use:**
```bash
# Change port in app.py last line: port=5001
```

**PDF export fails:**
```bash
pip install reportlab
```

**Models not loading:**
```bash
# Models are included in ml_models/ folder
# If missing, run notebooks/model_training.ipynb
```

**CSV import errors:**
- Download the template from Inventory page
- Ensure UTF-8 encoding
- Check that required columns exist

---

Built with ❤️ for Indian shopkeepers | Flask + XGBoost + Chart.js 4 | Dark Glassmorphism UI
=======
# FORESIGHT-INVENTORY--AI-Based-Sales-Forecasting-And-Inventory-Optimization-System
ForeSight Inventory is an AI-powered smart inventory management and demand forecasting system built using Flask, Machine Learning, Random Forest, and XGBoost. It predicts future product sales, optimizes stock levels, and provides intelligent reorder recommendations using seasonal, festival, and historical sales insights.
>>>>>>> 2dd7beda3aa7cab8586b3dff9e0459caa9c35e3f
