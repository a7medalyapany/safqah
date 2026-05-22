# Research Findings

## Reference App Analysis (AE System)

The reference app (AE System, Windows desktop Arabic POS) was analyzed screen by screen
before architecture was finalized. Key observations that shaped decisions:

### What the reference app does well

- Colorful KPI stat cards on every list screen (not just dashboard) — gives instant
  context without navigating away
- "إجراءات سريعة" (quick actions) section on dashboard — reduces navigation depth for
  the most common tasks
- AI-powered comprehensive report (local, no external API call) — competitive
  differentiator worth noting for future
- Barcode label printer configuration with live preview — shop owners configure this once
  and never touch it again
- Per-item color + size variants in the item table — essential for clothing retail

### What we will do differently

- No trial/license screen baked into core flow — licensing is a stub, addable later
- Simpler color scheme — the reference uses heavy gradients on every card; we use
  flat design that ages better and is easier to maintain with shadcn/ui
- Stricter error handling — reference shows raw errors sometimes; we enforce Arabic-only
  error messages to the user at the architecture level

### Egyptian market specifics

- Currency: Egyptian Pound (ج.م) — Tailwind v4 + Arabic-indic numerals
- Keyboard layout: cashiers often use Arabic keyboard; barcode scanner acts as
  dedicated input device regardless
- Hardware: shop PCs are often low-spec (4GB RAM, spinning HDD) — this informed the
  choice of SQLite over embedded PG and Tauri over Electron
- Print: Xprinter thermal printers are dominant in Egyptian retail market

## Domain Research — What Engineers Get Wrong in POS

### 1. Money with floats

The classic. `0.1 + 0.2 = 0.30000000004` in JavaScript. In a POS system this compounds:
apply a 10% discount on a 3-item invoice, multiply by quantity, sum 50 line items —
the rounding error accumulates and the receipt total doesn't match what the cashier
said out loud. Decision: store integers (milliemes), format only at display layer.

### 2. Non-atomic sale

Naive implementation: INSERT invoice → UPDATE stock → INSERT payment. If the app
crashes between steps 1 and 2, the invoice exists with no stock change. Or stock
decrements without a payment record. Decision: single DB transaction for every sale,
wrapped in sqlx `begin()` / `commit()`.

### 3. Inventory race conditions

Two cashiers selling the last unit simultaneously on separate machines. Both read
`current_stock = 1`, both proceed to sell. Result: `current_stock = -1`. Since this
is a single-machine app, SQLite's single-writer model prevents this natively — only
one write can happen at a time. If we ever go multi-machine, this needs revisiting
with `SELECT ... FOR UPDATE` or optimistic locking.

### 4. Report query performance

Loading 2 years of invoices with a naive JOIN kills the UI on shop hardware. Research
shows two approaches: (a) pre-aggregated daily snapshots written at session close,
(b) indexed queries with tight `WHERE` clauses and no `SELECT *`. We chose (b) with
indexes on `invoices.created_at`, `invoice_items.item_id`, and enforcing query time
under 200ms in the governance checklist.

### 5. Barcode scanner as keyboard

Scanners present as HID keyboard devices. They fire keystrokes faster than any human
— a 13-digit EAN barcode arrives in ~50ms. The naive approach (listening to `onChange`
on the search input) works but misfires on human typing. The correct approach: debounce
with a 100ms window + minimum character count (8+) before treating input as a scan.
Implemented in `useBarcodeScanner` hook.

### 6. Arabic decimal formatting

JavaScript's `Intl.NumberFormat` with `ar-EG` locale produces Arabic-indic numerals
(٠١٢٣٤٥٦٧٨٩) which is what Egyptian shop owners expect on receipts. The `money.ts`
utility handles this. Do not use `toFixed(2)` + manual append.

### 7. Shift / session management

If session state is not clean on crash, cash reconciliation is wrong. The session must
be reopenable on restart (app checks for unclosed session on launch), not auto-closed.
Cashier closing is always explicit with cash count verification.

## Risk Register (from Phase 1)

| Risk                               | Mitigation                                                | Status                    |
| ---------------------------------- | --------------------------------------------------------- | ------------------------- |
| Float money math                   | Integer milliemes throughout, `money.ts` enforced         | Mitigated in architecture |
| Non-atomic sale                    | sqlx transaction wrapping T-023                           | Mitigated in architecture |
| RTL breaks in component update     | shadcn logical CSS + `dir=rtl` on HTML root + RtlProvider | Mitigated in architecture |
| Barcode scanner misfires           | `useBarcodeScanner` hook with debounce + min-length       | Mitigated in T-013        |
| SQLite corruption on hard shutdown | WAL mode + `PRAGMA synchronous=NORMAL` + auto-backup      | Mitigated in architecture |
| Report N+1 queries                 | Pre-aggregated Rust commands, no ORM, indexed queries     | Mitigated in T-050        |
| Print job lost on disconnect       | Print queue with retry in `print_queue.rs`                | Mitigated in T-025        |

## Technology Decisions Summary

Full decision logs live in `docs/decisions/`. Summary:

| Decision             | Chosen                  | Key reason                                        |
| -------------------- | ----------------------- | ------------------------------------------------- |
| Desktop framework    | Tauri v2                | 10MB binary vs 150MB Electron; Rust backend       |
| Frontend             | React + TypeScript      | Engineer familiarity; massive agent training data |
| UI library           | shadcn/ui + Tailwind v4 | Known stack; RTL-capable; Vite-native             |
| Database             | SQLite WAL mode         | Zero server; single file; portable backup         |
| Money representation | INTEGER milliemes       | No float errors; SQL SUM works correctly          |
| Rust DB driver       | sqlx                    | Compile-time SQL checking; no ORM hiding          |
| Password hashing     | argon2                  | Memory-hard; industry standard                    |
| Print protocol       | ESC/POS raw bytes       | Universal; no printer driver needed               |
