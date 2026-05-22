# Decision: Money Representation

**Date:** Phase 2  
**Status:** Final — irreversible once data exists

## Chosen: INTEGER milliemes (EGP × 1000)

`10.50 ج.م` is stored as `10500` in the database.

## Why Not REAL (float)

Floating-point arithmetic is not associative. `0.1 + 0.2` in IEEE 754 is
`0.30000000000000004`. In a POS system this error compounds:

```
line 1: 33.33 ج.م × 3 items = 99.99000000000001 (float)
line 2: 10% discount on above = 9.999000000000001 (float)
total shown on receipt: 89.991...
total customer pays: 89.99
discrepancy: 0.001 ج.م per invoice × 100 invoices/day = 0.1 ج.م/day
```

Over a year: ~36 ج.م in unaccountable discrepancy. This destroys trust with the owner.

## Why INTEGER milliemes

- All arithmetic is exact (integers don't lose precision)
- SQL `SUM()`, `AVG()`, `GROUP BY` all work correctly on integers
- No special handling needed — the DB just stores a number
- 1 millieme = 0.001 ج.م → supports 3 decimal places (more than enough for EGP)
- Maximum storable value: `9,223,372,036,854,775,807` milliemes = 9.2 trillion EGP
  (SQLite INTEGER is 64-bit signed) — no overflow risk

## The One Rule

**All money formatting happens in `src/shared/utils/money.ts` only.**

```typescript
// Only two exports. That's it.
export function toMillieme(input: string | number): number
export function formatEGP(milliemes: number): string
```

`formatEGP` uses `Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2 })`
to produce Arabic-indic numerals: `١٠٫٥٠ ج.م`

If you find division by 100 or multiplication by 100 anywhere outside this file,
it is a bug. Treat it as such.

## Implications (12-18 months)

- If the business ever deals in sub-millieme amounts (unusual for retail), the
  representation would need to change. This is essentially impossible in Egyptian
  retail — the smallest coin is 25 piastres (250 milliemes). No action needed.
- If a different currency is added (e.g. for a dual-currency shop), add a
  `formatCurrency(milliemes, currency)` overload to `money.ts`. Do not add
  a second money column type.

## Reversibility: Irreversible (once data is written)

A schema migration to change money columns from REAL to INTEGER would require
a data conversion step. This is why the decision is locked before the first
migration is written.
