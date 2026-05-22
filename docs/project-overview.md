# POS System — Project Overview

## What This Is

A production-grade Arabic desktop POS (Point of Sale) application for small-to-medium
Egyptian retail businesses. Built to replace or compete with systems like Micro POS and
AE System. Designed to run on a single Windows machine, fully offline, with no cloud
dependency for core operations.

The system manages the full retail lifecycle: items, inventory, sales, purchases,
customers, suppliers, cash flow, and reporting — all in Arabic with RTL layout.

## Who Uses It

| Role | Primary screens | Key need |
|---|---|---|
| Cashier (كاشير) | POS sale screen | Speed — complete a sale in under 10 seconds |
| Store manager | Inventory, reports | Accurate stock numbers, daily P&L |
| Accountant | Finance, reports | Receivables, payables, cash reconciliation |
| Owner | Dashboard, reports | Morning summary, profit visibility |

## Non-Negotiables

- Arabic RTL layout — no English ever shown to end users
- Data never lost — every sale is atomic (all-or-nothing DB transaction)
- POS screen is the fastest path — no loading spinners on the critical sale flow
- Money is always integers (milliemes) — never floating point
- Offline-first — no internet required for any core function

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Desktop shell | Tauri v2 | ~10MB binary, OS webview, Rust backend |
| Frontend | React 19 + TypeScript | Team familiarity, agent-friendly |
| Styling | Tailwind v4 + shadcn/ui | Known stack, RTL via `dir=rtl`, Vite-native |
| State | Zustand + React Query | Lightweight, predictable |
| Rust backend | sqlx + tokio | Compile-time SQL, async, no ORM |
| Database | SQLite (WAL mode) | Zero-server, single file, portable |
| Printing | ESC/POS via Rust | Universal thermal printer protocol |
| Routing | react-router-dom v7 | SPA routing inside Tauri window |

## Project Structure

```
pos-app/
├── src/                        React frontend
│   ├── app/                    Layout, router, providers
│   ├── modules/                One folder per business module
│   │   ├── dashboard/
│   │   ├── pos/                ← most critical module
│   │   ├── items/
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── purchases/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── finance/
│   │   ├── reports/
│   │   └── settings/
│   ├── shared/
│   │   ├── components/         RTL-aware UI primitives
│   │   ├── hooks/              useBarcodeScanner, useToast, etc.
│   │   ├── utils/
│   │   │   └── money.ts        ONLY place that touches money math
│   │   └── types/
│   └── store/                  Zustand slices
│       ├── cartSlice.ts
│       ├── authSlice.ts
│       └── sessionSlice.ts
│
├── src-tauri/                  Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/           One file per module
│   │   ├── db/
│   │   │   └── migrations/     sqlx migration files, never edited after applied
│   │   ├── models/             Rust structs matching DB tables
│   │   ├── services/
│   │   │   ├── money.rs        Integer millieme arithmetic
│   │   │   ├── print_queue.rs  ESC/POS job queue with retry
│   │   │   └── backup.rs       Auto-backup scheduler
│   │   └── errors.rs           AppError → { code, message_ar, message_en }
│   └── Cargo.toml
│
└── docs/                       This folder — updated with every relevant change
    ├── project-overview.md     ← you are here
    ├── architecture.md
    ├── research-findings.md
    ├── execution-roadmap.md
    ├── debugging-notes.md
    ├── future-improvements.md
    └── decisions/
```

## What Success Looks Like

**For the cashier:** Open app, start shift, scan item, press confirm, receipt prints. Under
10 seconds. Never crashes. Never loses a sale.

**For the owner:** Open app each morning. Dashboard shows yesterday's sales, today's cash
on hand, items that need restocking. One screen, no navigation required.

**For the engineer:** Adding a new report takes under an hour. Adding a new item field
takes one migration + one Rust model update + one form field. No surprises.
