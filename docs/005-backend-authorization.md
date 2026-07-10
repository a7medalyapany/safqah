# Decision: Backend Authorization Enforcement

**Date:** 2026-07-10
**Status:** Final

## Problem

Role-based access originally lived only in the frontend router
(`featurePermissions` in `authSlice`). The Rust commands trusted every IPC
call, so any code running in the webview (devtools, a compromised dependency,
a curious cashier) could invoke admin-only operations — user management,
settings writes, backups, financial mutations — without a session.

## Chosen: token-guarded commands, matrix mirrored from the frontend

- `login` issues a 128-bit random token (`OsRng`), stored in a Rust-managed
  `SessionStore` (token → user id). It never touches disk on the Rust side.
- The single frontend `invoke()` wrapper injects the stored token into every
  command call. Tauri ignores extra args, so unguarded commands need no change.
- Each command declares `sessions: State<SessionStore>` + `token:
  Option<String>` and calls `guard::require_role(...)` before any work:
  token → user lookup → active check → role check.
- Role sets (`commands/guard.rs`) mirror the frontend map exactly, so no
  workflow changed:

| Role set | Commands |
|---|---|
| admin only | user management, `update_settings`, `vacuum_database`, `get_db_file_size`, backups/restore, CSV imports |
| admin + accountant | purchases, finance (except ledger view + invoice collection), reports (except the 4 dashboard reports) |
| admin + cashier | item/category writes, `adjust_stock`, `get_item_movements` |
| any authenticated | POS/sales, sessions, reads, printing, `get_customer_ledger`, `record_invoice_payment`, dashboard reports |
| pre-auth | `login`, `logout`, `get_current_user`, `is_first_launch`, `ping`; `complete_setup` + `seed_sample_data` self-disable after first launch |

Two placements are deliberate and derived from real call sites, not the page
matrix: `get_customer_ledger` / `record_invoice_payment` are used by the
customer ledger sheet (all roles), and `report_daily_sales` /
`report_sales_by_period` / `report_top_items` / `report_low_stock` feed the
dashboard (all roles).

## Alternatives rejected

- **"Current user" in managed state, no token** — a webview reload or stale
  state could leave a privileged session dangling; tokens already existed.
- **Tauri capability system** — scopes plugin permissions per window, cannot
  express per-command custom role logic.
- **Per-command frontend token plumbing** — ~90 call sites; the single
  `invoke()` wrapper achieves the same with one change.

## Implications

- The backend is now the authority; frontend guards are UX convenience.
- New commands must call `require_role` — the review checklist and
  `guard.rs` tests are the enforcement points.
- Sessions are memory-only: a full app restart logs everyone out (the token
  in localStorage dies against a fresh `SessionStore`). This is acceptable
  for a single-shop desktop app and mirrors pre-change behavior.

## Reversibility

Easy — the guard is one line per command; removing it restores the old
behavior without data changes.
