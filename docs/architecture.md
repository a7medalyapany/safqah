# Architecture

## System Overview

Three-layer desktop application. No server. No cloud. Single SQLite file on disk.

```
┌─────────────────────────────────────────┐
│  React Frontend (WebView2 / OS webview) │
│  Zustand · React Query · shadcn/ui      │
└──────────────┬──────────────────────────┘
               │  invoke() / Tauri IPC
┌──────────────▼──────────────────────────┐
│  Rust Backend (Tauri v2 commands)       │
│  sqlx · tokio · ESC/POS · argon2        │
└──────────────┬──────────────────────────┘
               │  sqlx pool (WAL mode)
┌──────────────▼──────────────────────────┐
│  SQLite — pos.db                        │
│  {appdata}/pos/pos.db                   │
└─────────────────────────────────────────┘
```

## Frontend Architecture

### Routing
`react-router-dom` v7 with a root layout that includes the sidebar nav and the RTL
provider. All routes are lazy-loaded so the POS screen has priority bundle weight.

```
/                   → dashboard
/pos                → POS sale screen (most critical)
/items              → item management
/sales              → invoice list
/purchases          → purchase invoices
/customers          → customer list + ledger
/suppliers          → supplier list + ledger
/finance            → cash vouchers, expenses
/reports            → reports hub
/settings           → app settings
```

### State Management

Two layers of state — never mixed:

**Zustand (client state — no server round-trips needed):**
- `cartSlice` — active sale cart, line items, discount, payment method, customer
- `authSlice` — logged-in user, role, permissions
- `sessionSlice` — active shift (open/closed), opening cash

**React Query (server state — Tauri invoke = "the server"):**
- All DB reads go through React Query with appropriate `staleTime`
- Mutations invalidate relevant query keys on success
- The POS item search uses `staleTime: 5 * 60 * 1000` (items don't change mid-sale)

### RTL Strategy

```html
<!-- index.html -->
<html dir="rtl" lang="ar">
```

`RtlProvider.tsx` wraps all Radix UI portals (Dialog, Sheet, Popover, DropdownMenu)
with `dir="rtl"` because portals mount outside the React tree and do not inherit
the `<html>` attribute automatically.

Tailwind v4 `rtl:` variant is available for the few cases needing explicit flip.
shadcn/ui components use logical CSS properties (`margin-inline-start` instead of
`margin-left`) which flip automatically with `dir=rtl`.

### Money Display Rule

**One function. One place.**

`src/shared/utils/money.ts` exports exactly two functions:
- `toMillieme(input: string | number): number` — parses any user input to integer milliemes
- `formatEGP(milliemes: number): string` — formats to Arabic-indic numeral string with ج.م suffix

No other file does money formatting. No other file does money parsing. If you find
yourself writing `/ 100` or `* 100` anywhere outside this file, stop and use the util.

## Rust Backend Architecture

### Command Pattern

Every Tauri command follows this signature:

```rust
#[tauri::command]
pub async fn command_name(
    db: State<'_, DbPool>,
    payload: CommandPayload,
) -> Result<ResponseType, AppError>
```

`AppError` serializes to JSON automatically:
```json
{ "code": "ITEM_NOT_FOUND", "message_ar": "الصنف غير موجود", "message_en": "Item not found" }
```

The frontend reads `message_ar` for toast display. `code` is used for programmatic
error handling (e.g. `DUPLICATE_BARCODE` shows a specific field error).

### Transaction Rule

Any command that touches more than one table MUST use an explicit transaction:

```rust
let mut tx = db.begin().await?;
// ... all DB ops use &mut tx
tx.commit().await?;
```

If commit fails, sqlx automatically rolls back. No partial state ever reaches the DB.
This is non-negotiable — it's what prevents a sale from decrementing stock without
saving the invoice.

### Commands by Module

| File | Commands |
|---|---|
| `commands/items.rs` | `create_item`, `update_item`, `delete_item`, `list_items`, `get_item_by_barcode`, `search_items` |
| `commands/sales.rs` | `create_sale_invoice`, `create_return`, `list_invoices`, `get_invoice_detail` |
| `commands/purchases.rs` | `create_purchase_invoice`, `list_purchases` |
| `commands/inventory.rs` | `adjust_stock`, `list_stock_movements`, `get_low_stock_items` |
| `commands/customers.rs` | `create_customer`, `update_customer`, `list_customers`, `get_customer_ledger` |
| `commands/suppliers.rs` | `create_supplier`, `update_supplier`, `list_suppliers`, `get_supplier_ledger` |
| `commands/finance.rs` | `create_expense`, `record_payment`, `list_expenses`, `get_cash_summary` |
| `commands/reports.rs` | `report_daily_sales`, `report_top_items`, `report_low_stock`, `report_profit`, `report_payment_methods`, `report_customer_balances`, `report_supplier_balances` |
| `commands/print.rs` | `print_receipt`, `print_barcode_labels`, `list_printers` |
| `commands/auth.rs` | `login`, `logout`, `create_user`, `list_users`, `update_user_role` |
| `commands/settings.rs` | `get_settings`, `update_settings` |
| `commands/backup.rs` | `trigger_backup`, `list_backups`, `restore_backup` |

## Database Architecture

### File Location
`{appdata}/pos/pos.db`

On Windows: `C:\Users\{user}\AppData\Roaming\pos\pos.db`

### Startup PRAGMAs (applied on every connection pool init)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;   -- 64MB page cache
PRAGMA temp_store = MEMORY;
```

### Core Tables (summary — full DDL in migrations)

```
items               — product catalog
categories          — item categories
customers           — customer master + balance
suppliers           — supplier master + balance
sessions            — cashier shifts
users               — app users + hashed passwords
invoices            — sale invoice header
invoice_items       — sale invoice lines
purchase_invoices   — purchase invoice header
purchase_items      — purchase invoice lines
stock_movements     — immutable event log of every stock change
payments            — all money movements (in/out, any direction)
expenses            — operating expenses
settings            — key-value app configuration
```

### The Stock Movement Pattern

`items.current_stock` is a derived value maintained by commands — it is always the
sum of all `stock_movements` for that item. The `stock_movements` table is the source
of truth. It is append-only. No row is ever updated or deleted.

Every stock change writes one row:
```sql
INSERT INTO stock_movements (item_id, delta, type, reference_id, created_at)
VALUES (?, ?, 'sale' | 'purchase' | 'return' | 'adjustment', ?, CURRENT_TIMESTAMP)
```

`delta` is positive for stock-in, negative for stock-out.

This gives free audit trail, free movement history per item, and makes the جرد
(inventory count) reconciliation trivial.

### Money in the DB

All money columns are `INTEGER` (milliemes = EGP × 1000).
- `10.50 ج.م` stored as `10500`
- All SQL `SUM()`, `AVG()` operations work correctly on integers
- Display layer in `money.ts` handles formatting

Never store `REAL` for money. This is enforced at the schema level — money columns
are typed `INTEGER NOT NULL`.

## Print Architecture

### ESC/POS
Thermal receipt printers speak ESC/POS byte commands. The `print.rs` command builds
the byte sequence in Rust and sends it directly to the printer port. No printer driver
dialog — it's a raw serial/USB write.

### Print Queue
`print_queue.rs` is an in-memory queue with retry. If the printer is offline:
1. Job queued with 3 retry attempts, 5-second intervals
2. User sees Arabic toast: "الطابعة غير متصلة — سيتم إعادة المحاولة"
3. On reconnect, job fires automatically

### Barcode Labels
Label printing uses a separate command path (`print_barcode_labels`) targeting a
label printer (Xprinter XP-365B or similar). Label size, content fields, and quantity
configurable from settings.

## Security Model

This is a single-machine desktop app. The threat model is internal (unauthorized
employee access), not external (network attackers).

- Passwords hashed with `argon2` (memory-hard, resistant to brute force)
- No network ports opened by the app
- Tauri CSP configured — no inline scripts, no eval
- All file access via Tauri's scoped filesystem plugin
- No telemetry, no analytics, no external requests

## Backup Strategy

`backup.rs` runs as a Tokio background task:
1. On session close → immediate backup
2. Every 4 hours while app is open → automatic backup
3. Keeps last 7 backups, deletes older ones
4. Backup = file copy of `pos.db` to `{appdata}/pos/backups/pos_YYYYMMDD_HHMM.db`
5. Restore = file copy back + app restart (Tauri restart command)

The user can also trigger manual backup from Settings and see the backup list.
