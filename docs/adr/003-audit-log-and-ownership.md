# ADR 003 — Tamper-evident audit log and client ownership protection

**Status:** Accepted (2026-09-30)

## 1. Hash-chained audit log

**Context.** The old activity log was written by an Express middleware *after* the response was sent. It wasn't in the same transaction as the change, so a failed write could leave a change unlogged and a rolled-back change could still be logged. It only covered creates and updates, and anyone with database access could edit or delete entries without trace.

**Decision.** `services/auditService.js` appends one `AuditLog` entry per change, **inside the caller's transaction**:
1. `$inc` the `audit` counter, reading the previous sequence number and chain head (`returnDocument: "before"`).
2. `hash = sha256(prevHash + canonicalJSON(entry))`. Canonical JSON sorts keys and serialises ObjectIds and Dates the same way before and after a round trip through MongoDB.
3. Store the entry and move the chain head to the new hash.

`verifyChain()` walks the log in sequence order and reports the first entry that doesn't match. That covers:
- an edited entry
- a recomputed hash, which breaks the next entry's `prevHash`
- a missing sequence number
- deleted trailing entries, which no longer match the counter

It's exposed at `GET /api/activity/verify` (admins only).

**What gets recorded:**
- client/property create, update and delete
- uploads
- match create, update and delete
- change request create, approve, reject, conflict and withdraw
- account creation
- login success, failure and blocked
- ownership claims

Each entry stores `before`/`after` for the changed fields, the actor, and the request ID. The request ID comes through `AsyncLocalStorage`, so it doesn't have to be threaded through every function. Passwords and hashes are never stored.

**Consequences:**
- Audit entries commit or roll back with the change they describe. Tests prove a rolled-back transaction leaves no entry and doesn't advance the chain.
- Every audit write updates one counter document, so audit writes are serialised. MongoDB turns concurrent attempts into write conflicts and the transaction helper retries them. A test with 50 concurrent writers produces a gap-free, valid chain. At much higher write rates you'd chain per entity or hash in batches.
- The chain proves *integrity*, not *secrecy*. Someone with full database access could rewrite the whole chain from a given point. Periodically publishing the head hash (e.g. emailing it daily) would close that gap and is noted as future work.
- `/api/activity` now reads the audit log, so the existing Activity page shows richer data without changes. The old `activitylogs` collection was copied into the chain as `legacy: true` entries by a migration and left in place.

## 2. Client ownership protection

**Context.** In a brokerage, two brokers often register the same buyer, and commission follows whoever got there first. Before this change nothing stopped duplicates, and nothing proved who came first.

**Decision:**
- **One key per number.** Phone numbers are normalised to `+91XXXXXXXXXX` (`utils/phone.js`), so `098765 43210`, `+91-98765-43210` and `919876543210` are the same key.
- **The database enforces it.** `Client.phoneKey` has a unique partial index, which covers only live clients because the key is removed on soft delete. The database, not an application check, guarantees one owner, including when two brokers submit at the same instant. A read-then-insert check alone would race.
- **A duplicate from another broker** returns **409 `CLIENT_ALREADY_REGISTERED`** with only `registeredAt` and a claim ID: no name, contact details or broker. It also opens an `OwnershipClaim`. The claim's evidence is the sequence number and hash of the existing client's first audit entry.
- **A duplicate from the same broker** gets a 409 pointing to their own record, and no claim is opened.
- **Admins resolve claims** with `POST /api/ownership-claims/:id/resolve`:
  - `keep`: the current broker keeps the client.
  - `transfer`: reassigns the client through the approval engine as an admin edit, in the **same transaction** as the decision, so both are audited together. The claim is taken with a conditional update on `status: "open"`, so concurrent clicks resolve it once.

**Existing data.** A migration backfills `phoneKey`, oldest client first. Later duplicates and numbers that can't be normalised are *reported*, not merged, and left without a key so the index can build. At migration time production had no duplicates.

**Consequences:**
- Invalid phone numbers are now rejected at creation (400 with a clear message). Existing records are only re-validated when their phone changes.
- Changing a client's phone to a number another client already has returns 409.
- Ownership is per phone number. A buyer who uses two numbers can still be registered twice; that's accepted as a residual risk.
