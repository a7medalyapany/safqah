# Safqah POS - صفقة

<p align="center">
  <img width="2160" height="1440" alt="dashboard" src="https://github.com/user-attachments/assets/3d406ad3-32ce-47d8-8938-ee7b99512e05" />
</p>

<p align="center">
  <strong>Offline-first Arabic Point of Sale built with React, Rust, Tauri, and SQLite.</strong>
</p>

<p align="center">
  Designed for small businesses and electricity equipment shops with barcode sales, inventory management, purchasing, finance, reporting, and local backup workflows.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue">
  <img src="https://img.shields.io/badge/React-19-61DAFB">
  <img src="https://img.shields.io/badge/Rust-stable-orange">
  <img src="https://img.shields.io/badge/SQLite-WAL-green">
  <img src="https://img.shields.io/badge/RTL-Arabic-success">
</p>

---

## Why Safqah?

Most POS systems assume a reliable internet connection and push business-critical operations into the cloud.

Safqah takes a different approach.

It is designed to run entirely on the local machine while maintaining accurate inventory, customer balances, financial records, and reporting. The application continues operating even when the internet is unavailable.

### Key Advantages

- Offline-first architecture
- Native desktop performance through Tauri
- RTL-first Arabic experience
- Exact money calculations using integer milliemes
- Portable SQLite database
- Simple file-based backup and restore
- Transactional inventory and accounting workflows
- Barcode-driven checkout
- Low memory footprint compared to Electron-based alternatives

---

## Screenshots

### Point of Sale

<img width="2160" height="1440" alt="pos" src="https://github.com/user-attachments/assets/49578485-48ec-41e2-99a2-415e9dba0bed" />

### Reports & Analytics

<img width="2160" height="1440" alt="reports" src="https://github.com/user-attachments/assets/3186d55f-fa44-4e3d-a6f0-cb3796723723" />
<img width="2160" height="1440" alt="Analytics" src="https://github.com/user-attachments/assets/43c96aa0-0c20-4259-a6e7-743ee5ab1492" />

---

## Overview

Safqah is an offline-first Arabic desktop point-of-sale system built for shops that need to keep selling even when the network is unavailable.

The current deployment targets small businesses, especially electricity equipment stores that rely on barcode-driven checkout, inventory control, customer balances, purchasing workflows, and cash tracking.

Unlike generic POS software, Safqah is intentionally focused:

- RTL-first from the ground up
- Single portable SQLite database
- Rust-powered desktop backend
- Exact monetary calculations
- Transactional inventory operations
- Simple deployment and recovery

Backups are simple copies of a single database file (`pos.db`), making disaster recovery straightforward without requiring cloud infrastructure.

---

## Modules

| Module    | Highlights                                                    |
| --------- | ------------------------------------------------------------- |
| POS       | Barcode checkout, discounts, split payments, receipt printing |
| Inventory | Stock tracking, adjustments, barcode labels                   |
| Purchases | Supplier invoices, cost tracking, purchase history            |
| Customers | Ledgers, deferred invoices, balance tracking                  |
| Suppliers | Payables and supplier management                              |
| Finance   | Expenses, receipts, payments, cash flow                       |
| Reports   | Sales, profit, inventory, balances                            |
| Settings  | Users, printers, backups, imports                             |

---

## Features

### Point of Sale - نقطة البيع

- Barcode search and scanner-driven item entry
- Fast cashier workflow optimized for keyboard use
- Category filtering and item browsing
- Per-line discounts and price overrides
- Customer selection and deferred sales
- Cash, card, deferred, and split payments
- Receipt printing
- PDF invoice generation
- WhatsApp invoice sharing

### Inventory - إدارة المخزون

- Item creation and management
- Barcode-based lookup
- Category management
- Manual stock adjustments
- Stock movement history
- Barcode label printing
- Low-stock monitoring

### Purchases - المشتريات

- Supplier purchase invoices
- Invoice status management
- Purchase history tracking
- Cost tracking
- Price suggestion workflows
- Supplier-based filtering

### Customers & Suppliers - العملاء والموردين

- Customer and supplier management
- Balance tracking
- Ledger views
- Deferred invoice tracking
- Payment history
- CSV import support

### Finance - المالية

- Customer receipts
- Supplier payments
- Expense vouchers
- Expense categorization
- Partial payment collection
- Cash movement tracking

### Reports - التقارير

- Daily sales reports
- Period sales reports
- Top-selling products
- Profit analysis
- Payment method distribution
- Customer balance reports
- Supplier balance reports
- Low-stock reports
- CSV export
- Printable reports
- Interactive charts

### Settings & Backup - الإعدادات والنسخ الاحتياطي

- Shop branding
- Receipt customization
- Printer management
- Tax configuration
- User and role management
- Backup creation and restoration
- CSV imports
- Database maintenance tools
- First-launch setup wizard

---

## Architecture

Safqah uses a three-layer architecture:

1. React renders the user interface.
2. Tauri IPC bridges frontend actions into Rust commands.
3. SQLite persists the entire business state.

The React layer handles cashier workflows, dialogs, and reporting.

The Rust layer owns:

- Database transactions
- File operations
- Printing
- PDF generation
- Backup management
- Password hashing

SQLite stores the entire shop state inside a single local database.

### Architecture Diagram

```text
┌─────────────────────────────┐
│  React + TypeScript (RTL)   │
│  Zustand · React Query      │
└──────────┬──────────────────┘
           │ invoke()
┌──────────▼──────────────────┐
│  Rust (Tauri v2 Commands)   │
│  sqlx · argon2 · ESC/POS    │
└──────────┬──────────────────┘
           │ SQLite WAL
┌──────────▼──────────────────┐
│      SQLite - pos.db        │
│    Portable Single File     │
└─────────────────────────────┘
```

---

## Production-Oriented Design

Safqah was designed around reliability and operational simplicity.

### Exact Money Calculations

All monetary values are stored as integer milliemes.

This avoids floating-point rounding errors and guarantees deterministic totals, taxes, discounts, and balances.

### Transactional Inventory Updates

Sales and purchase operations execute inside SQL transactions.

Invoice creation, stock updates, payment records, and balance adjustments either succeed together or roll back together.

### Append-Only Audit Trail

Inventory changes are recorded in an append-only stock movement log.

Historical inventory activity is never overwritten.

### Secure Authentication

User passwords are hashed using Argon2 before storage.

### Portable Recovery

The entire business state lives inside a single SQLite database file.

Backups are simply copies of `pos.db`.

---

## Tech Stack

| Layer             | Technology            |
| ----------------- | --------------------- |
| Desktop           | Tauri v2              |
| Frontend          | React 19 + TypeScript |
| Backend           | Rust                  |
| Database          | SQLite (WAL)          |
| Database Access   | SQLx                  |
| State Management  | Zustand               |
| Server State      | TanStack Query        |
| Styling           | Tailwind CSS          |
| Password Hashing  | Argon2                |
| Charts            | Recharts              |
| Barcode Rendering | React Barcode         |

---

## Prerequisites

- Windows 10/11 (primary target)
- Linux or macOS
- Rust Stable
- Cargo
- Node.js 20+
- WebView2 on Windows
- ESC/POS-compatible thermal printer (optional)

---

## Getting Started

```bash
git clone https://github.com/a7medalyapany/safqah.git

cd safqah

npm install

npm run tauri dev
```

### Production Build

```bash
npm run tauri build
```

---

## Database Location

The database is created automatically on first launch.

### Windows

```text
%APPDATA%\pos\pos.db
```

### Linux

```text
~/.local/share/pos/pos.db
```

### macOS

```text
~/Library/Application Support/pos/pos.db
```

---

## Development Credentials

⚠️ Development builds ship with default credentials.

| Field    | Value    |
| -------- | -------- |
| Username | admin    |
| Password | admin123 |

Change these immediately in production deployments.

---

## Project Structure

```text
safqah/
├── src/
│   ├── app/
│   ├── modules/
│   │   ├── pos/
│   │   ├── items/
│   │   ├── sales/
│   │   ├── purchases/
│   │   ├── parties/
│   │   ├── finance/
│   │   ├── reports/
│   │   ├── settings/
│   │   ├── sessions/
│   │   └── dashboard/
│   ├── store/
│   ├── shared/
│   └── components/ui/
│
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   ├── db/
│   │   ├── models/
│   │   └── services/
│   └── Cargo.toml
│
└── docs/
```

---

## Development Notes

### Reset Database

Delete `pos.db` and relaunch the application.

### Reset Setup Wizard

```bash
sqlite3 ~/.local/share/pos/pos.db \
"UPDATE settings SET value='0' WHERE key='setup_complete';"
```

### Run Rust Tests

```bash
cd src-tauri

cargo test
```

### Inspect Query Plans

```bash
sqlite3 ~/.local/share/pos/pos.db \
"EXPLAIN QUERY PLAN ..."
```

---

## Contributing

Issues and pull requests are welcome.

For major changes, please open an issue first so implementation details and deployment impact can be discussed before development begins.
