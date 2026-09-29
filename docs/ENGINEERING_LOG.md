# Engineering Log

Short entries for notable bugs: how they were found, why they happened, how they were fixed.

---

## 2026-09-29 — Authorization matrix exposes object-level access gaps

**Found by:** `backend/tests/authz.matrix.test.js`, a table-driven test that calls every endpoint as admin, the owning broker, another broker and an anonymous user, and asserts the expected status code.

**Failures on first run (5 matrix rows + 1 scoping test):**

| Row | Expected | Actual | Cause |
|---|---|---|---|
| Other broker uploads a document to a client they don't own | 403 | 200 | `addClientDocument` checked only that the client exists |
| Other broker edits a property they didn't add | 403 | 200 | `updateProperty` had no ownership check |
| Other broker uploads a property image | 403 | 200 | `addPropertyImage` had no ownership check |
| Other broker lists matches of a client they don't own (includes client phone/email) | 403 | 200 | `getMatchesByClient` had no authorization |
| Other broker links someone else's client to a property | 403 | 201 | `createMatch` checked existence, not ownership |
| Matches-by-property returns other brokers' client links | own links only | all links | `getMatchesByProperty` had no scoping |

**Also found:**
- Brokers could create a client already in `closed` stage or a property already `sold`, because create handlers spread `req.body` into the model (mass assignment). Covered by `tests/createPolicy.test.js`.
- Uploads were stored in Cloudinary *before* any authorization ran, so a rejected request still left a file behind. Covered by `tests/uploads.test.js`.

**Root cause:** ownership checks were written per controller, by hand, and several handlers never got one.

**Fix:** see the next entry.

### Fix: policy module and validation on every route

- One policy module (`backend/policies/index.js`) defines who can read/update/upload/link/delete each resource type.
- Routes now run `loadResource → authorize(action) → validate → handler`. On upload routes authorization runs **before** Multer, so a rejected request never stores a file.
- Request bodies and queries are parsed with Zod schemas (`backend/validation/schemas.js`). Create schemas whitelist fields, so `pipelineStage`, `status`, codes and timestamps can't be set by the client. Pagination is bounded (`1 ≤ limit ≤ 100`); malformed ids and queries return 400 instead of 500.
- Search input is escaped before being used in `$regex`.
- Login returns 401 for bad credentials, rejects non-string input, and disabled accounts are blocked at login and on every request.

**Result:** the authorization matrix has no known failures; `KNOWN_FAILURES` is empty and any new entry would be a regression.

---

## 2026-09-29 — Approval workflow rebuilt as a transactional engine

**Problems found (analysis + tests):**
- Property change requests were written but never readable or approvable (only the client copy of the controller had a resolver).
- Every save created a change request, even for unchanged values, because the UI sends the whole form.
- Approval was check-then-act: concurrent approvals could apply twice and send two emails; a crash between writes could leave the record changed but the request still pending.
- Approving an old request silently overwrote newer values.

**Fix:** see [ADR 001](adr/001-approval-engine.md). Verified by `tests/approval.test.js`:
- no-op edits create nothing
- 5 concurrent approvals → exactly one 200, four 409s, one entity update, one notification (repeated 20×)
- stale requests become `conflict`
- invalid approvals roll back

**Caught in the browser (Edge, sandbox):** after proposing a budget change, pressing *Save* again resent the still-displayed value and superseded the first request with an identical one. Fixed server-side: re-submitting a value that's already pending now reuses the existing request (test: "re-submitting an already pending value reuses the same request").

---

## 2026-09-29 — Analytics built on stage events; indexes and pagination measured

**Problem.** "Closed deals per month" grouped closed clients by `updatedAt`, so any later edit moved the closure month. The demo seed had been hand-tuning `updatedAt` to make the chart look plausible. Funnel and time-in-stage were impossible to compute. Several lists had no index behind their filter or sort.

**Fix.** See [ADR 002](adr/002-soft-delete-and-stage-history.md):
- `StageTransition` events are written transactionally with every stage change.
- Analytics read events: monthly closures, a cumulative funnel, median time in stage, and conversion = closed ÷ (closed + lost).
- Compound indexes match the actual list queries.
- The activity feed supports keyset (cursor) pagination.
- Codes come from atomic counters.
- Deletes are soft deletes with a transactional cascade.

**Measured** with `npm run bench` (100k clients, 30k properties, 100k activity logs; [full results](../backend/bench/results/2026-09-29.md)). p50 before → after indexes:
- Broker's client list: 202 ms → 30 ms (6.7×)
- Closures by month: 245 ms → 26 ms (9.4×)
- Property search: 171 ms (substring scan) → 27 ms (text index)
- Activity feed 40k rows deep: offset 89 ms vs keyset 52 ms, with indexes

Property search uses the text index for whole words and falls back to a substring scan only when the text search finds nothing, e.g. for partial words or property codes.

**Not solved by indexes (next steps):**
- The dashboard summary and broker-performance aggregations (~160–180 ms p50) scan whole collections. That's inherent to `$group` over everything, and the fix is pre-aggregation (e.g. per-broker counters updated in the approval transaction) or a short cache.
- "Broker's matches" (111 ms) filters with a `$in` over the broker's ~5k client ids. Denormalising the client's broker onto the match would turn it into a single index lookup.

---

## 2026-09-30 — An audit trail you can check, and one owner per buyer

**Problem:**
- The activity log was written by middleware after the response was sent, outside the transaction.
  - A failed write left a change unlogged, and a rolled-back change could still be logged.
  - It covered only creates and updates: no deletes, uploads, match changes or logins.
  - Entries could be edited without trace.
- Separately, nothing stopped two brokers from registering the same buyer. In brokerages that is exactly where commission disputes start.

**Fix:** see [ADR 003](adr/003-audit-log-and-ownership.md).
- **Audit log:**
  - Entries are written inside the change's own transaction and hash-chained through a counter document that holds the chain head.
  - `verifyChain()` pinpoints the first edited, recomputed or missing entry.
  - The old activity log was migrated into the chain as legacy entries.
- **Ownership:**
  - Phone numbers are normalised to `+91XXXXXXXXXX`, with a unique partial index on the key.
  - A duplicate from another broker returns 409 without leaking the existing record, and opens an ownership claim carrying the first audit entry as evidence.
  - Admins keep or transfer the client; a transfer goes through the approval engine in the same transaction.

**Tests that pin it down:**
- A rolled-back transaction leaves no entry and doesn't advance the chain.
- 50 concurrent audit writes give a gap-free, valid chain.
- Editing an entry, recomputing its hash, or deleting one is each detected at the right sequence number.
- Two brokers registering the same number at the same moment get exactly one 201 and one 409 (10 rounds).
- The claimant's 409 contains none of the owner's name, email, broker or code.
- Three concurrent "transfer" clicks: one 200, two 409s.

**Trade-off:** one counter document serialises audit writes. That's fine at CRM volumes; beyond that you'd chain per entity or hash in batches. The chain proves integrity against edits, not against someone rewriting the whole database. Publishing the head hash periodically would cover that.

---

## 2026-09-30 — Frontend: the bugs users actually hit

**Problems** (found in the code review, reproduced in the browser):
- Brokers were sent to the admin dashboard after login, and their first screen was an error card.
- An expired token never signed anyone out; every page just showed errors after 7 days.
- Dark mode couldn't be switched off after starting dark: `App` and `Sidebar` each kept their own theme state.
- Edit forms sent every field on every save.
- Approve and reject used `window.confirm` and `window.prompt`.
- Conflicts showed only "not applied", without the values involved.
- The property list was hard-capped at 100 with no pages.
- Upload errors showed Axios's generic message instead of the server's.

**Fixes:**
- **Routing:** each role has a home page (`/dashboard` or `/clients`), and a `RequireRole` guard covers admin screens.
- **Sessions:** a response interceptor signs the user out on any 401 (except the login call itself) and explains why on the login page. The React Query cache is cleared on every logout, so the next user never sees the previous user's data.
- **Theme:** one `ThemeProvider`.
- **Edit forms:**
  - The form is diffed against what was loaded, and only the changed paths are sent.
  - `GET /api/meta/edit-policies` tells the UI which of those fields need approval, so the rules live only on the server.
  - A per-record history panel shows the audit log. Brokers can see any action on records they can read, but not ownership claims, which name the competing broker.
- **Approval queue:** Pending / Conflicts / History tabs. The API attaches each conflicted field's *current* value, so an admin sees "requester saw → now → requested".
- **Dialogs:** a promise-based `useConfirmDialog()` replaces the browser prompts: `const result = await confirm({...})`.
- **Properties:** server-side pages with a debounced search box.

**Tests:**
- React Testing Library covers the following:
  - brokers never land on the dashboard, whatever URL they open
  - a 401 signs out; a 403 or a failed login doesn't
  - only the changed field is sent
  - saving with no changes sends nothing
  - the approval dialog flow
  - one theme toggle updates every consumer
- One Playwright test runs the full approval flow in a browser against the sandbox API. It runs in CI, and locally with the installed Edge.
