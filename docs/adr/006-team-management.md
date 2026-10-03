# ADR 006 — Team management: revoking sessions and offboarding brokers

**Status:** Accepted (2026-10-03)

## Context

Adding a broker meant calling the API by hand. There was no way to deactivate a broker who left, reset a password, or hand a leaving broker's clients to someone else. That matters for a CRM whose core promise is "who owns this buyer": a departed broker must lose access at once, and their buyers must not be left without an owner.

## Decisions

**1. Revoking JWTs with a session version.** JWTs are stateless, so on their own they can't be revoked before they expire. Two mechanisms close that gap:
- **Deactivation** takes effect on the next request. `verifyToken` already loads the user on every request and rejects inactive accounts, so no token denylist is needed.
- **Password reset** increments `User.tokenVersion`. Every token carries the version it was issued with (`tv`), and `verifyToken` rejects any token whose version doesn't match: `401 SESSION_REVOKED`. That signs the user out on every device. Tokens issued before this change have no `tv` and count as version 0, so deploying it signed nobody out.

The cost is one indexed user lookup per request, which the app was already doing. A Redis denylist would only be needed if the per-request lookup were dropped for speed.

**2. Generated passwords are shown once.** If the admin leaves the password blank, the server generates 16 characters with every character class, from an alphabet without look-alikes (no 0/O or 1/l/I). It's returned exactly once and stored only as a bcrypt hash. Tests check that it never appears in the audit log.

**3. Never zero admins, even under concurrency.** "You can't deactivate the last active admin" is a check-then-act. Two admins deactivating *each other* at the same moment each read "2 active admins" and write a different document. Under MongoDB's snapshot isolation that is **write skew**: both transactions commit and no admin remains.

The fix: every admin deactivation also increments one shared `admin-roster` counter inside its transaction. The two transactions now write the same document, so one of them hits a write conflict and is retried. On the retry it sees the other's change and fails with `409 LAST_ADMIN`.

**Measured:** with audit writes stubbed out and the guard removed, 20 out of 20 concurrent rounds ended with zero admins. With the guard, 0 out of 20 did. The audit chain's own counter happens to serialize these transactions too, but the guard keeps the invariant from depending on that side effect. A test pins it.

Admins also can't deactivate themselves.

**4. Offboarding moves clients in one transaction.** `POST /users/:id/reassign-clients` moves every live client of the leaving broker to an active broker. Each move goes through the approval engine (`proposeChanges` with the outer session), so it's validated and audited like any ownership change. One summary entry records the batch. A failure on any client rolls back all of them; a test injects a failure part-way through.

In the UI, deactivating a broker who still has clients opens an offboarding dialog: "Move clients & deactivate", or "Deactivate, keep clients" when an admin really wants that.

## Consequences

- Every team action is audited: create, deactivate, reactivate, password reset, reassignment.
- Shortlist links a departed broker created keep working for the buyer. Feedback alerts go to whoever owns the client now.
- One transaction is fine at brokerage scale: tens of clients per broker. Thousands would call for batching with a resumable job.
