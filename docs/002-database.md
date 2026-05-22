# Decision: Database

**Date:** Phase 2  
**Status:** Final — do not revisit without a confirmed multi-machine requirement

## Chosen: SQLite with WAL mode via sqlx (Rust)

## Alternatives Considered

**Embedded PostgreSQL (pg_embed or similar)**
- Rejected because: runs a full PG server process in the background (~50MB RAM idle),
  complex to bundle, overkill for a single-machine app. Connection pooling overhead
  not justified.

**better-sqlite3 (Node/JavaScript)**
- Rejected because: Tauri v2 backend is Rust, not Node. Adding a Node sidecar just
  for the DB introduces a whole separate process management problem.

**Prisma via sidecar**
- Rejected because: same Node sidecar problem. Also Prisma's migration story for
  embedded SQLite is immature.

**LiteFS / Turso (SQLite with sync)**
- Rejected because: adds cloud dependency. This is explicitly offline-first.
  Viable if multi-machine sync is required in the future — re-evaluate then.

## Why SQLite + sqlx

- Zero server process — just a file on disk
- WAL (Write-Ahead Logging) mode: concurrent reads + single writer, no lock contention
- `sqlx` gives compile-time SQL checking — typos in queries are caught at `cargo build`,
  not at runtime in the customer's shop
- Single `.db` file = backup is a file copy, restore is a file copy
- Proven at scale: SQLite handles millions of rows without issue for read-heavy workloads
- sqlx async API fits Tauri's tokio runtime perfectly

## Startup PRAGMAs (applied on every pool init)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA temp_store = MEMORY;
```

`synchronous = NORMAL` (not FULL) gives significant write performance improvement
with acceptable durability — on crash, at most the last transaction may be lost,
but WAL mode ensures no corruption. Combined with auto-backup, this is the right
tradeoff for a retail environment.

## Implications (12-18 months)

- If the client ever needs two cashier PCs in one shop hitting the same data, SQLite's
  single-writer model becomes a bottleneck. At that point, evaluate PostgreSQL migration
  (the sqlx query API is nearly identical — migration is a port, not a rewrite).
- DB file grows over time. A shop doing 100 sales/day generates ~5MB/month in SQLite.
  After 2 years: ~120MB. SQLite handles this fine. No action needed.
- `VACUUM` should be run periodically (e.g. once a month, triggered from settings)
  to reclaim space from deleted rows.

## Risks

- SQLite does not support `ALTER COLUMN` — schema changes require creating a new table,
  copying data, dropping old table. sqlx migrations handle this, but it must be planned.
  Never edit a migration file that has already been applied.
- Hard shutdown during a write: WAL mode protects against corruption but the in-flight
  transaction is lost. Auto-backup mitigates data loss risk.

## Reversibility: Hard (after data exists)
