# Future Improvements

Captured ideas that are out of scope for v1 but should not be forgotten.
Review this list before starting v2 planning.

---

## Licensing / Monetization
- Hardware fingerprint binding (machine ID generated from CPU + disk serial)
- License server: REST API that validates a license key against a machine ID
- Trial mode: full features, 30-day time limit, data preserved after trial
- The architecture supports this — add a Rust `commands/license.rs` and a
  startup check in `main.rs`. No DB schema changes needed.

**Why deferred:** First deployment is for a friend. Adds complexity before
the core product is proven.

---

## AI-Powered Report (like AE System)
- Local LLM (llama.cpp sidecar or Ollama) analyzes sales data and generates
  Arabic-language narrative summary: "أفضل يوم مبيعات كان الجمعة، المنتج الأكثر
  مبيعاً هو X، يُنصح بزيادة المخزون من Y"
- No external API call — fully offline, privacy-preserving
- The reference app (AE System) has this and it's a clear differentiator

**Why deferred:** Requires shipping an LLM binary (~2-4GB). Not appropriate
for v1 where we're still proving the core POS loop.

---

## Multi-Branch Support
- `branches` table, all records scoped by `branch_id`
- Stock transfers between branches
- Consolidated reports across branches
- Each branch runs its own app instance; a central sync server merges data

**Why deferred:** Single-machine architecture decision. Multi-branch requires
revisiting the database decision (SQLite → PostgreSQL) and adding a sync layer.
Do not attempt to retrofit this — plan it as a v2 architecture.

---

## WhatsApp Invoice Sending
- After sale, option to send receipt to customer's WhatsApp
- Requires WhatsApp Business API or a local WhatsApp Web bridge
- High demand feature in Egyptian retail market

**Why deferred:** External API dependency, requires business account setup.
Good v1.5 feature once core is stable.

---

## E-commerce Integration
- Sync item catalog and stock with an online store (WooCommerce / Shopify)
- Incoming online orders appear in the POS as pending invoices

**Why deferred:** Requires internet connectivity and external API integration.
Out of scope for offline-first v1.

---

## Mobile Companion App
- Read-only dashboard for the owner on their phone
- See today's sales without being at the PC

**Why deferred:** Requires a local network server or cloud sync. Architecture
would need to expose a local REST API from the Tauri app. Feasible but complex.

---

## Customer Loyalty Points
- Points earned per purchase, redeemable as discount
- `loyalty_points` column on `customers` table (already reserved in schema notes)
- Points transaction log

**Why deferred:** Schema supports it (balance tracking already exists). UI and
business rules not defined yet. Add in v1.5.

---

## Barcode Label Design Editor
- Visual drag-and-drop label designer
- The current implementation has fixed templates configurable via settings
- A visual editor would be a strong differentiator

**Why deferred:** High effort, low priority for v1. The fixed templates cover
90% of use cases.

---

## Automated DB Maintenance
- Scheduled `VACUUM` (monthly, triggered on app open if last vacuum > 30 days)
- Archive invoices older than 2 years to a separate `archive.db`
- `ANALYZE` after large bulk imports to update query planner statistics

**Why deferred:** Not needed until DB reaches ~500MB. Flag to revisit when
a shop reports slow report queries.
