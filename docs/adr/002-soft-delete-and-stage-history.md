# ADR 002 — Soft delete, stage history and atomic codes

**Status:** Accepted (2026-09-29)

## 1. Soft delete instead of hard delete

**Context.** Deleting a client or property removed the document outright. Matches and change requests kept dangling references, the uploaded files were never cleaned up, and there was no record of what had existed.

**Decision.**
- Clients and properties get `deletedAt` and `deletedBy`.
- A Mongoose plugin (`models/plugins/softDelete.js`) hides deleted documents from every query and aggregation unless the caller passes `{ withDeleted: true }`.
- Deletion runs in one transaction that:
  - marks the record deleted
  - removes its matches (links, not records of their own)
  - closes its pending change requests as `withdrawn`

**Consequences.**
- Deleted records return 404 from the API and drop out of lists and dashboards, but stay in the database for audit and recovery.
- `$lookup` stages from other collections bypass the plugin and must filter `deletedAt` themselves.
- Event-based analytics (closures by month, funnel) still include the history of later-deleted clients: a deal that closed did happen.

## 2. Stage history as events

**Context.** "Closed deals per month" was computed by grouping closed clients by `updatedAt`. Any later edit to a closed client moved its closure month, and direct edits via `findByIdAndUpdate` skipped the hook that set `updatedAt`, so the metric was inconsistent by construction. Funnel and time-in-stage metrics were impossible.

**Decision.** An append-only `StageTransition { client, from, to, changedBy, via, at }` row is written in the same transaction as every stage change: on creation, on direct admin edits, and on approved change requests. Analytics read these events:
- **Closures per month:** transitions to `closed`, grouped by month (empty months return 0).
- **Funnel:** the furthest stage each client reached. It is cumulative: reaching `negotiation` counts as having passed `lead`, `contacted` and `site_visit`.
- **Median time in stage:** gaps between a client's consecutive transitions, via `$setWindowFields` + `$shift`. Stages a client is still in are excluded.
- **Conversion:** closed ÷ (closed + lost). Open leads aren't failures yet.

**Existing data.** A migration inserts one `null → currentStage` row per existing client, flagged `backfilled: true`. The timestamp is approximate (`updatedAt` for non-leads), and time-in-stage ignores backfilled rows.

## 3. Atomic sequence counters for codes

**Context.** Codes were generated as "find the highest code, add one". Two concurrent creates got the same code, and the unique index turned one of them into an error. Property codes also broke after `99ZZ`, because `"100AA"` sorts before `"99ZZ"` as a string.

**Decision.** A `counters` collection with `findOneAndUpdate({ $inc: { seq: 1 } }, { upsert: true })` reserves the next number atomically, and codes are *encoded* from it. A migration seeds the counters from the highest existing codes using `$max`, so it's safe to re-run and never moves a counter backwards.

**Consequence.** Codes are unique under any concurrency (tested with 50 parallel creates). A code reserved inside a transaction that later aborts leaves a gap, which is acceptable for display codes.
