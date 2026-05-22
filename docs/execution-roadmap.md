# Execution Roadmap

Live tracker. Update status column as tasks complete.
Status: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## M0 — Scaffold (~2 days)

| ID    | Task                                            | Status | Notes |
| ----- | ----------------------------------------------- | ------ | ----- |
| T-001 | Tauri v2 + React + TS project init              | `[x]`  |       |
| T-002 | RTL provider + `dir=rtl` on html root           | `[x]`  |       |
| T-003 | Tailwind v4 + shadcn/ui setup                   | `[x]`  |       |
| T-004 | SQLite + sqlx + first migration (WAL + PRAGMAs) | `[x]`  |       |
| T-005 | AppError type + `ping` command skeleton         | `[x]`  |       |
| T-006 | `money.ts` util + unit tests                    | `[x]`  |       |
| T-007 | App shell + sidebar nav + stub routes           | `[x]`  |       |

**M0 exit criteria:** `npm run tauri dev` opens a window with RTL sidebar, SQLite
file exists on disk in WAL mode, `formatEGP(10500)` returns `"١٠٫٥٠ ج.م"`.

---

## M1 — Items + Entities (~5 days)

| ID    | Task                                            | Status | Notes          |
| ----- | ----------------------------------------------- | ------ | -------------- |
| T-010 | Items + categories DB schema + migration        | `[ ]`  | depends: T-004 |
| T-011 | Items Rust CRUD commands                        | `[ ]`  | depends: T-010 |
| T-012 | Items management UI (table + CRUD + stat cards) | `[ ]`  | depends: T-011 |
| T-013 | `useBarcodeScanner` hook                        | `[ ]`  | depends: T-012 |
| T-014 | Customers + suppliers schema + commands + UI    | `[ ]`  | depends: T-004 |
| T-015 | Category management                             | `[ ]`  | depends: T-010 |

**M1 exit criteria:** Add an item with barcode, color, size. Search it by name and
by barcode (both keyboard and simulated scanner). Add a customer and a supplier.
All data persists after app restart.

---

## M2 — POS Sale Screen (~7 days) ← CRITICAL

| ID    | Task                                                    | Status | Notes                        |
| ----- | ------------------------------------------------------- | ------ | ---------------------------- |
| T-020 | Sessions (shift) system — schema + commands + Zustand   | `[ ]`  | depends: T-007               |
| T-021 | Cart Zustand slice + money math                         | `[ ]`  | depends: T-006               |
| T-022 | POS screen UI                                           | `[ ]`  | depends: T-020, T-021, T-013 |
| T-023 | `create_sale_invoice` Rust command (atomic transaction) | `[ ]`  | depends: T-010, T-014        |
| T-024 | Invoice list + detail view                              | `[ ]`  | depends: T-023               |
| T-025 | Thermal receipt print (ESC/POS + print queue)           | `[ ]`  | depends: T-023               |
| T-026 | Return (مرتجع) flow                                     | `[ ]`  | depends: T-023               |

**M2 exit criteria:** Open shift → scan item → add to cart → apply discount →
select customer → pay cash → receipt prints → invoice in list → stock decremented.
Close app mid-sale, reopen → sale not partially saved (full rollback).

---

## M3a — Purchases (~4 days) [parallel with M3b]

| ID    | Task                                                        | Status | Notes          |
| ----- | ----------------------------------------------------------- | ------ | -------------- |
| T-030 | Purchase invoice schema + `create_purchase_invoice` command | `[ ]`  | depends: T-023 |
| T-031 | Purchase UI                                                 | `[ ]`  | depends: T-030 |
| T-032 | Stock movements log UI (per-item history)                   | `[ ]`  | depends: T-023 |
| T-033 | Manual stock adjustment (جرد)                               | `[ ]`  | depends: T-030 |

**M3a exit criteria:** Create purchase for 3 items from a supplier → stock for each
item increases → stock movements log shows purchase event.

---

## M3b — Finance (~3 days) [parallel with M3a]

| ID    | Task                                  | Status | Notes                 |
| ----- | ------------------------------------- | ------ | --------------------- |
| T-040 | Expenses + payments schema + commands | `[ ]`  | depends: T-014        |
| T-041 | Cash vouchers UI (سند قبض / سند صرف)  | `[ ]`  | depends: T-040        |
| T-042 | Deferred invoice payment tracking     | `[ ]`  | depends: T-023, T-040 |

**M3b exit criteria:** Create deferred invoice → shows in مديونيات list → record
partial payment → outstanding balance reduces correctly.

---

## M4 — Reports + Dashboard (~5 days)

| ID    | Task                                         | Status | Notes                       |
| ----- | -------------------------------------------- | ------ | --------------------------- |
| T-050 | All report Rust commands (indexed, <200ms)   | `[ ]`  | depends: M3a + M3b complete |
| T-051 | Reports hub UI (grid + date filter + export) | `[ ]`  | depends: T-050              |
| T-052 | Dashboard (KPIs + charts + alerts)           | `[ ]`  | depends: T-050              |
| T-053 | CSV export + print for all reports           | `[ ]`  | depends: T-051              |

**M4 exit criteria:** Seed 10k invoices. All 8 report commands return in under 200ms.
Dashboard loads in under 1 second. CSV export downloads a valid file.

---

## M5 — Hardening (~4 days)

| ID    | Task                                                        | Status | Notes                 |
| ----- | ----------------------------------------------------------- | ------ | --------------------- |
| T-060 | Users + roles + login screen + argon2                       | `[ ]`  | depends: T-007        |
| T-061 | Auto-backup (session close + 4hr interval + restore)        | `[ ]`  | depends: T-004        |
| T-062 | Settings screen (shop info, tax, printer, receipt template) | `[ ]`  | depends: T-007        |
| T-063 | Error boundaries + Arabic toast for all AppErrors           | `[ ]`  | depends: M2 complete  |
| T-064 | Performance audit (POS <1s, search <100ms, 8hr memory)      | `[ ]`  | depends: M4 complete  |
| T-065 | First-launch wizard + seed data                             | `[ ]`  | depends: T-060, T-062 |

**M5 exit criteria:** Login as cashier → reports hidden. Login as admin → everything
visible. Force a DB error → Arabic toast, no crash. App runs 8 hours with no memory
growth. Backup file appears in appdata after session close.

---

## Governance Checkpoints

Before marking any milestone done, verify:

- [ ] All tasks in milestone are `[x]`
- [ ] No raw English visible to end users anywhere in the milestone's screens
- [ ] All money displayed via `formatEGP()` — no manual division
- [ ] All DB writes that touch multiple tables use explicit transactions
- [ ] Error cases show Arabic toast, app does not crash
- [ ] Docs updated if anything in architecture changed

---

## Dependency Graph (text form)

```
T-004 ──→ T-010 ──→ T-011 ──→ T-012 ──→ T-022
                │              │
                └──→ T-014    T-013 ──→ T-022
                │
T-006 ──────────────────────→ T-021 ──→ T-022
T-007 ──→ T-020 ──────────────────────→ T-022
                                          │
                              T-023 ←────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
                  T-024       T-025       T-026
                                │
                    T-030 ─────→ T-031
                    T-030 ─────→ T-032
                    T-040 ─────→ T-041
                    T-040 ─────→ T-042
                                │
                    T-050 ←─────┘ (all M3 done)
                    T-050 ──→ T-051, T-052, T-053
                    T-050 ──→ T-064
```

Critical path: T-001 → T-004 → T-010 → T-011 → T-022 → T-023 → T-050 → T-064
