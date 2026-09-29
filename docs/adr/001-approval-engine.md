# ADR 001 — Transactional approval engine

**Status:** Accepted (2026-09-29)

## Context

Sensitive edits (deal stage, budgets, asking price, city…) must be approved by an admin before they apply. The first implementation had four problems:

1. **Two copy-pasted models and controllers** (`ClientChangeRequest`, `PropertyChangeRequest`). Only the client copy had a resolver, so property requests could never be approved.
2. **No diffing.** The UI sends the whole form, so every save created a request, even when no sensitive value changed.
3. **Check-then-act approval.** `findById → if pending → apply → save` meant two admins approving at once could both apply the change, and a crash between the two writes left the record changed while the request stayed pending.
4. **No stale detection.** A request stores `oldValue`, but approval overwrote the field even if someone had changed it since.

## Decision

One engine (`backend/services/approvalService.js`) with a registry of entity types (`client`, `property` → model + field policy) and one `ChangeRequest` collection (`entityType`, `entityId` with `refPath`).

**Propose**
- Flatten the patch to dot-paths and classify each path as direct, approval-required or unsupported (unsupported → 400).
- Drop fields whose normalized value equals the current value.
- Validate the *merged* document up front, so a request that could never be applied is refused immediately.
- Apply direct fields and create the request in **one transaction**. Admin edits apply directly, since admins are the approvers.
- Overlap rules:
  - The same requester's older overlapping request is superseded, and its untouched fields are carried over.
  - Resubmitting exactly the pending values reuses the existing request (idempotent).
  - Another broker's pending request on the same fields → 409.

**Resolve** (inside `connection.transaction`)
1. **Atomic claim:** `findOneAndUpdate({ _id, status: "pending" }, { status: decision })`. Only one caller can win, so approval is exactly-once.
2. **Stale check:** every field's current value must still equal `oldValue`. If not, the status becomes `conflict` with `conflictFields` and nothing is applied.
3. Apply and `save()`, so schema validation runs. A validation failure aborts the transaction and the request stays pending.
4. Insert a `Notification` row (transactional outbox). Email is sent after commit by a dispatcher with retries, so SMTP latency or failure never affects the approval.

**Serializing writers:** every mutation increments the entity's `revision`. Two transactions touching the same record therefore write-conflict, and MongoDB retries one of them, which then sees the other's result. This covers races the status filter alone can't: a direct edit racing an approval, or two proposals racing each other.

## Alternatives considered

- **Optimistic locking on `__v` only:** detects concurrent document writes, but not "the field changed since the *request* was made", which can be days earlier. We need value-level stale detection anyway.
- **Single-document atomicity (embed requests in the entity):** avoids transactions, but makes listing and paging the approval queue across entities awkward, and the entity documents grow without bound.
- **Distributed lock (Redis):** adds infrastructure for a problem the database already solves.

## Consequences

- Requires a replica set: Atlas in production, `MongoMemoryReplSet` in tests and the local sandbox.
- A migration (`20260929120000-merge-change-requests`) moves legacy data; the legacy collections stay until production is verified.
- Covered by `backend/tests/approval.test.js`, including a 20× repeated concurrent-approval race.
