# MedSupply Intelligence

## AI-Powered Healthcare Inventory, Demand Forecasting & Procurement Intelligence Platform

MedSupply Intelligence is a healthcare supply-chain intelligence platform designed to help hospitals, pharmacies, and healthcare organizations manage medicine inventory, supplier invoices, consumption, demand forecasting, inventory risks, and procurement decisions from a single system.

The platform connects supplier invoice receiving, medicine stock-in, pharmacy billing, stock-out transactions, consumption history, demand forecasting, risk detection, and procurement recommendations into one continuous workflow.

---

## Problem Statement

Healthcare organizations need to maintain the right medicines in the right quantities at the right time.

Inventory management can become difficult when:

- Medicine consumption changes unexpectedly
- Critical medicines approach stockout
- Medicines expire before being used
- Supplier lead times are not considered
- Procurement quantities are manually calculated
- Invoice data must be entered manually
- Inventory and billing data are disconnected
- Abnormal consumption patterns are difficult to identify

MedSupply Intelligence addresses these problems by combining operational inventory data with demand forecasting, risk intelligence, and procurement recommendations.

---

# Proposed Solution

```text
                 SUPPLIER
                    |
                    v
             Supplier Invoice
                    |
                    v
              Invoice Upload
                    |
                    v
                OCR Engine
                    |
                    v
            Extracted Invoice Data
                    |
                    v
                 Stock IN
                    |
                    v
              Inventory DB
                    |
        +-----------+------------+
        |                        |
        v                        v
 Pharmacy Billing          Expiry Tracking
        |
        v
      Stock OUT
        |
        v
 Consumption History
        |
        v
 Python Forecast Engine
        |
        v
 Predicted Demand
        |
        v
 Risk Intelligence
        |
        v
 Procurement Engine
        |
        v
 Recommended Quantity
        |
        v
 Intelligence Dashboard
```

The system is designed to answer:

- What do we have?
- What are we consuming?
- What are we likely to need?
- What could go wrong?
- What should we procure?

---

# Key Features

## 1. Inventory Management

The Admin module manages medicine inventory.

Medicine information includes:

- Medicine name
- Category
- Unit
- Criticality
- Current stock
- Minimum stock
- Emergency reserve
- Expiry date
- Supplier
- Unit cost
- Inventory status

Inventory status can include:

```text
NORMAL
LOW
CRITICAL
STOCKOUT_RISK
EXPIRING_SOON
```

---

## 2. Supplier Management

The system maintains supplier information including:

- Supplier name
- Contact email
- Phone
- Lead time
- Reliability score
- Status

Supplier lead time is incorporated into inventory and procurement intelligence.

```text
Supplier
   |
   v
Lead Time
   |
   v
Expected Demand During Lead Time
   |
   v
Procurement Requirement
```

---

# 3. Supplier Invoice OCR

Supplier invoices can be uploaded in:

- PDF
- JPG
- JPEG
- PNG

The invoice is processed using OCR.

Technology:

```text
Multer
   |
   v
File Upload
   |
   v
Tesseract OCR
   |
   v
Text Extraction
   |
   v
Invoice Data Parsing
```

The system attempts to extract:

- Invoice number
- Supplier
- Invoice date
- Medicine name
- Batch number
- Quantity
- Expiry date
- Unit price

The administrator can verify extracted information before confirming inventory changes.

---

# 4. Stock IN

Supplier invoice processing represents incoming inventory.

Workflow:

```text
Supplier
   |
   v
Invoice
   |
   v
Upload
   |
   v
OCR
   |
   v
Verification
   |
   v
Stock IN
   |
   v
Inventory Update
   |
   v
Transaction Recorded
```

When stock is received:

- Inventory quantity increases
- Stock-IN transaction is recorded
- Batch information can be stored
- Expiry information can be updated
- Unit cost can be updated
- Inventory status is recalculated

---

# 5. Pharmacy Billing / Stock OUT

The Billing module handles medicine issuance.

The user can:

- Enter patient information
- Enter patient ID
- Enter bill reference
- Select medicines
- Enter quantities
- View current stock
- View estimated value
- Validate available quantity
- Confirm the bill

Workflow:

```text
Patient
   |
   v
Medicine Selection
   |
   v
Quantity
   |
   v
Stock Validation
   |
   v
Confirm Bill
   |
   v
Inventory Decrease
   |
   v
Stock OUT Transaction
   |
   v
Consumption History
```

The system validates available stock before issuing medicine.

---

# 6. Consumption History

Every medicine stock-out contributes to consumption history.

Consumption records contain:

- Item ID
- Consumption date
- Quantity consumed
- Usage type
- Creation timestamp

Usage types include:

```text
NORMAL
EMERGENCY
ABNORMAL
```

Consumption history becomes the input for demand forecasting.

```text
Billing
   |
   v
Stock OUT
   |
   v
Consumption History
   |
   v
Forecasting
```

---

# 7. AI Demand Forecasting

The demand forecasting engine is implemented in Python and integrated with the Node.js backend.

The current forecasting approach uses:

```text
Weighted Moving Average
          +
Trend Analysis
          +
Demand Variability
          |
          v
Predicted Daily Demand
```

The forecasting engine analyzes:

- 7-day average
- 30-day average
- Weighted recent demand
- Demand variability
- Trend change
- Predicted daily demand
- Confidence score

The system can generate forecasts for a configurable number of future days.

---

# 8. Python Forecast Engine

The Python forecasting engine is located at:

```text
ai/forecast.py
```

Node.js communicates with Python using a child process.

```text
Node.js
   |
   | JSON input
   v
Python Forecast Engine
   |
   | JSON output
   v
Node.js
   |
   v
Risk + Procurement Intelligence
```

Example output:

```json
{
  "success": true,
  "model": "Weighted Moving Average + Trend",
  "predicted_daily": 30.06,
  "trend": "STABLE",
  "confidence": 68
}
```

---

# 9. Forecasting Logic

The forecasting engine uses historical consumption to calculate recent and longer-term demand.

### 7-Day Average

Represents recent consumption.

### 30-Day Average

Represents longer-term consumption.

### Weighted Recent Demand

Recent consumption receives greater importance.

### Trend Analysis

Consumption is classified as:

```text
INCREASING
STABLE
DECREASING
```

### Variability

Measures fluctuations in consumption.

### Confidence

A confidence score is generated using historical data availability and demand variability.

---

# 10. Risk Intelligence

MedSupply Intelligence includes a dedicated risk engine.

The risk engine considers:

- Current stock
- Minimum stock
- Emergency reserve
- Daily demand
- Days of cover
- Supplier lead time
- Expiry
- Consumption trend
- Abnormal usage
- Medicine criticality

---

# 11. Days of Cover

Days of cover estimates how long current inventory can support predicted demand.

```text
Days of Cover = Current Stock / Predicted Daily Demand
```

Example:

```text
Current Stock    = 620
Daily Demand     = 24.3

Days of Cover
= 620 / 24.3
≈ 25.5 days
```

The system can compare days of cover against supplier lead time.

---

# 12. Stockout Risk

Stockout risk is detected when inventory may not be sufficient for expected demand.

Important conditions include:

```text
Current Stock = 0

OR

Days of Cover <= Supplier Lead Time
```

Medicine criticality is also considered when assigning risk severity.

---

# 13. Low Stock Detection

The system compares current stock against:

```text
Minimum Stock
```

and:

```text
Emergency Reserve
```

This provides a progression from healthy inventory to shortage risk.

---

# 14. Expiry Risk

Expiry information is monitored for inventory items.

The system identifies medicines approaching their expiry date.

```text
Medicine
   |
   v
Expiry Date
   |
   v
Days Remaining
   |
   v
Expiry Risk
```

---

# 15. Abnormal Consumption Detection

The system compares recent consumption with historical consumption.

A significant increase in recent usage can indicate abnormal consumption.

```text
Recent Average
      |
      v
Compare with
      |
      v
Historical Average
      |
      v
Significant Increase
      |
      v
ABNORMAL_USAGE
```

---

# 16. Procurement Intelligence

The procurement engine converts inventory and forecast information into a recommended procurement quantity.

```text
Lead Time Demand
        +
Safety Stock
        =
Target Inventory

Target Inventory
        -
Current Stock
        =
Recommended Procurement
```

---

# 17. Procurement Recommendation

Example:

```text
Medicine:
Antibiotic X

Current Stock:
250

Minimum Stock:
500

Emergency Reserve:
200

Predicted Daily Demand:
28.2 units/day

Supplier Lead Time:
12 days

Recommended Procurement:
800 units
```

---

# 18. Intelligence API

Main endpoint:

```http
GET /api/intelligence
```

This combines:

```text
Inventory
    +
Consumption History
    +
Python Forecast
    +
Risk Engine
    +
Procurement Engine
```

---

# 19. Intelligence Dashboard

The dashboard displays:

- Total medicines
- Total stock
- Critical risks
- Procurement requirements
- Risk distribution
- AI forecast information
- Priority medicines
- Inventory status
- Procurement recommendations
- Expiry watch

The dashboard dynamically loads intelligence from the backend.

---

# 20. Dashboard KPI Metrics

- **Total Medicines** — number of inventory items being monitored
- **Total Stock** — total units currently available
- **Critical Risks** — medicines requiring urgent attention
- **Procurement Need** — total recommended procurement quantity

---

# 21. Admin Page

The Admin page provides:

### Supplier Invoice

- Choose invoice
- Upload invoice
- OCR extraction
- View extracted information
- Verify extracted information
- Confirm inventory

### Medicine Management

- Medicine name
- Category
- Unit
- Criticality
- Stock
- Minimum stock
- Emergency reserve
- Expiry
- Supplier
- Unit cost

### Inventory

The current inventory can be viewed from the Admin page.

---

# 22. Billing Page

The Billing page provides:

- Patient name
- Patient ID
- Bill reference
- Medicine selection
- Quantity
- Current stock
- Estimated value
- Stock validation
- Recent transactions

Multiple medicines can be added dynamically to a bill.

---

# 23. Frontend

The frontend is built using:

- HTML5
- CSS3
- Vanilla JavaScript

Primary pages:

```text
Dashboard
Admin
Billing
```

Frontend structure:

```text
public/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── admin.js
│   ├── billing.js
│   └── dashboard.js
└── pages/
    ├── admin.html
    ├── billing.html
    └── dashboard.html
```

---

# 24. Responsive UI

The interface supports:

```text
Desktop
Tablet
Mobile
```

Responsive behavior is implemented for sidebar navigation, KPI cards, dashboard panels, forms, tables, billing rows, and procurement sections.

---

# 25. Backend Architecture

```text
Client
  |
  v
Express Server
  |
  +-- Routes
  |
  +-- Controllers
  |
  +-- Services
  |
  +-- Middleware
  |
  +-- Database
```

AI forecasting is integrated separately:

```text
Node.js
   |
   v
Python
```

---

# 26. Project Structure

```text
medsupply-intelligence/
│
├── .gitignore
├── .env
├── package.json
├── server.js
│
├── config/
│   └── db.js
│
├── controllers/
│   ├── medicineController.js
│   ├── billingController.js
│   ├── invoiceController.js
│   └── dashboardController.js
│
├── routes/
│   ├── medicineRoutes.js
│   ├── billingRoutes.js
│   ├── invoiceRoutes.js
│   └── dashboardRoutes.js
│
├── services/
│   ├── forecastService.js
│   ├── riskService.js
│   └── procurementService.js
│
├── middleware/
│   └── upload.js
│
├── ai/
│   ├── forecast.py
│   ├── anomaly.py
│   └── requirements.txt
│
├── data/
│   ├── inventory.csv
│   ├── consumption.csv
│   └── suppliers.csv
│
├── uploads/
│
└── public/
    ├── index.html
    ├── pages/
    │   ├── admin.html
    │   ├── billing.html
    │   └── dashboard.html
    ├── css/
    │   └── style.css
    └── js/
        ├── admin.js
        ├── billing.js
        └── dashboard.js
```

---

# 27. Database

The project uses MySQL 8.

Database:

```text
healthcare_supply_chain
```

Major tables:

```text
suppliers
medicines
batches
inventory_items
inventory_batches
transactions
consumption_history
invoices
demand_forecasts
risk_events
procurement_orders
```

---

# 28. Database Relationships

```text
suppliers
    |
    +---- invoices
    |
    +---- procurement_orders

medicines
    |
    +---- batches
    |
    +---- inventory_items
    |
    +---- transactions

inventory_items
    |
    +---- consumption_history
    |
    +---- demand_forecasts
    |
    +---- risk_events
```

---

# 29. Transaction Tracking

The `transactions` table records inventory movement.

Supported transaction types:

```text
IN
OUT
ADJUSTMENT
```

Examples:

```text
Supplier Invoice
      |
      v
IN Transaction
```

```text
Patient Billing
      |
      v
OUT Transaction
```

---

# 30. Batch Tracking

Batch-level information includes:

- Batch number
- Medicine
- Quantity
- Manufacturing date
- Expiry date
- Unit price
- Received date

---

# 31. Demand Forecast Storage

Forecast results can be stored in:

```text
demand_forecasts
```

Stored information includes:

- Item ID
- Forecast date
- Predicted demand
- Confidence
- Model name
- Generation timestamp

Example model:

```text
Weighted Moving Average + Trend
```

---

# 32. Risk Event Storage

Detected risks can be stored in:

```text
risk_events
```

Risk types:

```text
STOCKOUT
LOW_STOCK
EXPIRY
ABNORMAL_USAGE
SUPPLIER_DELAY
```

Risk severity:

```text
INFO
WARNING
HIGH
CRITICAL
```

Risk status:

```text
ACTIVE
RESOLVED
DISMISSED
```

---

# 33. Procurement Orders

Procurement information includes:

- Medicine
- Supplier
- Quantity
- Order date
- Expected delivery date
- Status
- Unit cost
- Total cost

Supported states:

```text
PENDING
ORDERED
IN_TRANSIT
DELIVERED
CANCELLED
```

---

# 34. API Endpoints

## Health

```http
GET /api/health
```

## Medicines

```http
GET /api/medicines
GET /api/medicines/suppliers
POST /api/medicines
```

## Billing

```http
GET /api/billing
POST /api/billing
```

## Invoices

```http
GET /api/invoices
POST /api/invoices/extract
POST /api/invoices
```

## Intelligence

```http
GET /api/intelligence
```

---

# 35. Environment Configuration

Create `.env`:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=healthcare_supply_chain
```

Do not commit `.env` to GitHub.

---

# 36. Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/medsupply-intelligence.git
cd medsupply-intelligence
```

Install Node.js dependencies:

```bash
npm install
```

Install Python dependencies:

```bash
pip install -r ai/requirements.txt
```

Verify Python:

```bash
python --version
```

Verify NumPy:

```bash
python -c "import numpy; print(numpy.__version__)"
```

---

# 37. Configure MySQL

Make sure MySQL is running.

The application expects:

```text
Database:
healthcare_supply_chain
```

Import the project database schema and seed data before starting the application.

---

# 38. Start the Application

Run:

```bash
node server.js
```

The server runs on:

```text
http://localhost:5000
```

Health endpoint:

```text
http://localhost:5000/api/health
```

Dashboard:

```text
http://localhost:5000/
```

Admin:

```text
http://localhost:5000/pages/admin.html
```

Billing:

```text
http://localhost:5000/pages/billing.html
```

---

# 39. Expected Server Output

```text
======================================
     MEDSUPPLY INTELLIGENCE
======================================

MYSQL: CONNECTED
Database: healthcare_supply_chain

Server: http://localhost:5000
Health: http://localhost:5000/api/health
Dashboard: http://localhost:5000/
Admin: http://localhost:5000/pages/admin.html
Billing: http://localhost:5000/pages/billing.html
======================================
```

---

# 40. Complete Operational Workflow

## Supplier to Inventory

```text
Supplier
   |
   v
Invoice
   |
   v
Upload
   |
   v
OCR
   |
   v
Extract Information
   |
   v
Admin Verification
   |
   v
Stock IN
   |
   v
Inventory
```

## Inventory to Patient

```text
Inventory
   |
   v
Medicine Selection
   |
   v
Patient Billing
   |
   v
Stock Validation
   |
   v
Stock OUT
   |
   v
Consumption History
```

## Consumption to Intelligence

```text
Consumption History
   |
   v
Python Forecast
   |
   v
Predicted Demand
   |
   v
Risk Analysis
   |
   v
Procurement Calculation
   |
   v
Dashboard
```

---

# 41. Complete Intelligence Loop

```text
          +----------------------+
          |      SUPPLIER        |
          +----------+-----------+
                     |
                     v
          +----------------------+
          |   INVOICE + OCR      |
          +----------+-----------+
                     |
                     v
          +----------------------+
          |      STOCK IN        |
          +----------+-----------+
                     |
                     v
          +----------------------+
          |      INVENTORY       |
          +----------+-----------+
                     |
                     v
          +----------------------+
          |     PHARMACY         |
          |      BILLING         |
          +----------+-----------+
                     |
                     v
          +----------------------+
          |      STOCK OUT       |
          +----------+-----------+
                     |
                     v
          +----------------------+
          | CONSUMPTION HISTORY  |
          +----------+-----------+
                     |
                     v
          +----------------------+
          |   AI FORECASTING     |
          +----------+-----------+
                     |
                     v
          +----------------------+
          |   RISK INTELLIGENCE  |
          +----------+-----------+
                     |
                     v
          +----------------------+
          |    PROCUREMENT       |
          |   RECOMMENDATION     |
          +----------+-----------+
                     |
                     v
          +----------------------+
          |     DASHBOARD        |
          +----------------------+
```

---

# 42. Seeded Inventory Scenarios

The project contains inventory scenarios for demonstrating different intelligence conditions.

Examples include:

### Insulin

```text
Current Stock: 1240
Minimum Stock: 700
Emergency Reserve: 500
Criticality: CRITICAL
Expiry: 2027-08-15
Supplier: LifeLine Pharma
```

### Ceftriaxone

```text
Current Stock: 620
Minimum Stock: 500
Emergency Reserve: 300
Criticality: CRITICAL
Expiry: 2026-10-10
```

### Atropine

```text
Current Stock: 95
Minimum Stock: 100
Emergency Reserve: 60
Criticality: CRITICAL
Expiry: 2026-11-05
```

### Azithromycin

```text
Current Stock: 900
Minimum Stock: 700
Emergency Reserve: 350
Criticality: HIGH
Expiry: 2026-10-02
```

### Antibiotic X

```text
Current Stock: 250
Minimum Stock: 500
Emergency Reserve: 200
Criticality: CRITICAL
Expiry: 2026-09-30
```

### Emergency IV Set

```text
Current Stock: 280
Minimum Stock: 300
Emergency Reserve: 150
Criticality: CRITICAL
```

These scenarios demonstrate normal, low-stock, critical, stockout-risk, abnormal-usage, and expiry conditions.

---

# 43. Example Risk Scenarios

The database includes examples of:

```text
LOW STOCK
STOCKOUT RISK
EXPIRY RISK
ABNORMAL USAGE
```

Example:

```text
Antibiotic X
      |
      +-- Low Inventory
      |
      +-- Increasing Consumption
      |
      v
STOCKOUT RISK
```

Example:

```text
Azithromycin
      |
      v
Expiry Approaching
      |
      v
EXPIRY WARNING
```

---

# 44. Why Node.js + Python

Node.js handles:

- REST APIs
- Database operations
- Inventory transactions
- Invoice processing
- Billing
- Business logic
- Frontend serving

Python handles:

- Demand forecasting
- Statistical calculations
- Data analysis
- Future ML model integration

---

# 45. Explainable Intelligence

The system separates prediction from decision logic.

### Prediction Layer

Python estimates:

```text
Predicted Demand
Trend
Variability
Confidence
```

### Decision Layer

The backend determines:

```text
Stock Risk
Expiry Risk
Reserve Risk
Lead-Time Risk
Procurement Quantity
```

Recommendations can be explained using:

```text
Current Stock
      +
Predicted Demand
      +
Supplier Lead Time
      +
Emergency Reserve
      =
Recommended Procurement
```

---

# 46. Security

The project uses environment variables for database configuration.

Sensitive configuration is excluded from Git:

```text
.env
```

Installed dependencies are excluded:

```text
node_modules/
```

Uploaded invoice files are excluded:

```text
uploads/*
```

Production deployments should additionally implement:

- Authentication
- Authorization
- Role-based access control
- HTTPS
- Secure file validation
- API rate limiting
- Input validation
- Audit logging
- Secure database credential management

---

# 47. Git Configuration

The project includes a `.gitignore` that excludes:

```text
.env
node_modules/
uploads/*
__pycache__/
*.log
.vscode/
.idea/
temporary files
local database files
```

This prevents secrets and generated files from being committed.

---

# 48. Current Technology Stack

```text
Frontend
----------------
HTML5
CSS3
Vanilla JavaScript

Backend
----------------
Node.js
Express.js
REST API

Database
----------------
MySQL 8

AI / Data Intelligence
----------------
Python
NumPy
Statistical Forecasting
Weighted Moving Average
Trend Analysis
Demand Variability

OCR
----------------
Tesseract.js

File Upload
----------------
Multer

Development
----------------
VS Code
Git
GitHub
Postman
Thunder Client
```

---

# 49. Project Goals

MedSupply Intelligence is designed to provide:

```text
Real-Time Inventory Visibility
             +
Demand Intelligence
             +
Risk Detection
             +
Procurement Intelligence
```

The overall goal is to move healthcare inventory management from reactive monitoring toward data-driven planning.

---

# 50. Future Enhancements

Potential future improvements include:

- Advanced time-series forecasting
- Seasonal demand prediction
- Machine-learning based anomaly detection
- Supplier performance prediction
- Automated purchase-order generation
- Email alerts
- SMS alerts
- Barcode scanning
- QR-based medicine tracking
- Batch-level FEFO management
- Multi-hospital inventory synchronization
- Multi-location inventory optimization
- Cloud deployment
- Authentication
- Role-based access control
- Hospital ERP integration
- Cost optimization
- Supplier comparison
- Procurement approval workflow
- Real-time notifications
- Advanced analytics
- Forecast accuracy monitoring

---

# 51. Project Vision

MedSupply Intelligence aims to transform healthcare inventory management from:

```text
Manual Monitoring
       |
       v
Reactive Procurement
       |
       v
Stockout / Expiry
```

towards:

```text
Real-Time Inventory
       |
       v
Consumption Intelligence
       |
       v
Demand Forecasting
       |
       v
Risk Detection
       |
       v
Procurement Intelligence
       |
       v
Proactive Supply Management
```

---

# 52. Final System

MedSupply Intelligence brings together:

```text
Inventory Management
        +
Supplier Management
        +
Invoice OCR
        +
Stock IN
        +
Pharmacy Billing
        +
Stock OUT
        +
Consumption History
        +
Python Demand Forecasting
        +
Risk Intelligence
        +
Procurement Recommendations
        +
Healthcare Dashboard
```

into a single healthcare supply-chain intelligence platform.

---

## MedSupply Intelligence

### From Inventory Data to Actionable Healthcare Supply Intelligence

Built as an AI-enabled healthcare supply-chain platform for inventory visibility, demand forecasting, risk detection, and procurement intelligence.
