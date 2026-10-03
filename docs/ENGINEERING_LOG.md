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

---

## 2026-09-30 — Matching, buyer shortlist links and re-match alerts

**Problem:**
- The app stored each client's budget, city, locality, size and bedrooms, then ignored them. Brokers matched clients to properties from memory.
- Properties went to buyers as WhatsApp forwards, and nobody knew which ones the buyer liked.
- When a listing's price dropped into a client's budget, nobody noticed.

**What was built:** see [ADR 004](adr/004-matching-and-shortlists.md) and [ADR 005](adr/005-outbox-and-rematch.md).
- **Matching:** candidates come from one indexed query; a weighted five-feature score comes with a reason per feature; a size-k heap picks the top-k. Dismissals and links are recorded as feedback, and the same scorer runs in reverse ("interested clients"). An offline harness reports precision@5 and NDCG@10 against random and price-only baselines, using weights tuned on held-out clients. The export writes no names, phones or emails.
- **Shortlist links:**
  - 32-byte tokens, stored only as SHA-256 hashes.
  - Unknown, expired and revoked links all get the same 404.
  - The public view is an allow-list of fields.
  - Rate limits apply per IP and per link.
  - Feedback is idempotent per (link, property), updates the match, is audited, and alerts the broker.
- **Re-match alerts:**
  - A `PropertyChanged` outbox event is written in the same transaction as the change.
  - The worker claims events atomically, retries with backoff and moves repeated failures to a dead-letter state.
  - Alerts are upserted on a unique `(eventId, client)` key, so reprocessing is harmless.

**Bugs found along the way:**
- **Alerts missed on price drops.** The first version scored the listing's *before* state as-is. A listing 20% over budget but otherwise perfect still scored about 0.65 on locality, bedrooms and freshness, so dropping its price into budget never "crossed" the 0.6 threshold and nobody was alerted. The fix: a before-state the client would never have been shown (not available, another city or type, >10% over budget) scores 0. A regression test pins it.
- **Dropdown hidden behind the page.** The notification dropdown rendered under the main content, because the sidebar's `backdrop-blur` creates a stacking context. The browser test caught it (the click timed out); the fix was an explicit `z-index` on the sidebar.

**Tests:**
- 217 backend tests.
- Shortlist security: the stored token never appears in the database, the allow-listed field set is checked, one 404 covers every invalid link, feedback is scoped to the link's own properties, and a per-link rate limit applies across different IPs.
- Re-match: a price drop alerts exactly once, reprocessing is idempotent, a rolled-back change leaves no event, a crashed worker's event is reclaimed, and a failing event ends up dead after 5 attempts.

## 2026-09-30 — Frontend patterns borrowed from tools people already use

- **Pipeline board (Pipedrive):** drag-and-drop between stages, with a "Move to" menu on each card for keyboard users. Brokers' moves become change requests and show "awaiting approval" on the card.
- **Command palette (Linear, Vercel):** Ctrl/Cmd+K searches clients, properties and pages, with arrow-key navigation.
- **Property cards (99acres, Zillow):** photo first, then a large ₹ L/Cr price with ₹/sq ft, spec chips and a status ribbon.
- **Buyer page:** mobile-first cards with three large reaction buttons.
- **Also:** toasts, a notification bell with 60 s polling, and search-as-you-type pickers in place of dropdowns capped at 100 items.
- **API docs:** an OpenAPI 3.1 spec is generated from the same Zod schemas the routes validate with, and a test fails if a documented path isn't a real route.

---

## 2026-10-03 — Team management, and the write skew the tests nearly missed

**Problem.**
- Adding a broker meant calling the API by hand.
- Nobody could deactivate a broker who left, reset a password, or hand a departing broker's clients to someone else.

**Fix:** see [ADR 006](adr/006-team-management.md).
- **Team page:** add, deactivate, reactivate, reset password, and move clients.
- **Session revocation:** each JWT carries `tokenVersion`, and a password reset bumps it, so old tokens get `401 SESSION_REVOKED`. Deactivation already took effect on the next request.
- **Offboarding:** all of a broker's clients move in one transaction, through the approval engine, audited per client. A failure part-way through rolls everything back, and a test injects one to prove it.

**The interesting bug: write skew.**
- The rule "you can't deactivate the last active admin" is a check-then-act.
- My first race test (two admins deactivating each other at the same moment) passed even without any guard, which made me suspicious.
- With audit writes stubbed out, the unguarded version ended with **zero admins in 20 out of 20 rounds**. Each transaction read "2 active admins" and wrote a *different* user document, so snapshot isolation let both commit.
- It only looked safe because every audited transaction also writes the audit-chain counter. That accidentally serialized them.
- **The fix:** an explicit `admin-roster` counter write inside each admin deactivation. With it: **0 out of 20**.
- **Lesson:** a passing concurrency test should be checked against a version without the guard. Otherwise you can't tell whether it proves anything.

---

## 2026-10-03 — A public landing page that search engines and link previews can read

**Problem.**
- `/` redirected straight to the login page, so Google and recruiters saw nothing.
- The app is a client-rendered SPA: `index.html` is an empty `<div id="root">`. Google renders JavaScript late and unreliably, and WhatsApp, LinkedIn and X previews never run it, so shared links showed a blank card.

**What I built:**
- **A landing page** using semantic sections, one `<h1>`, real `<a href>` links, screenshots with alt text and fixed dimensions, and a "Built & maintained by" credit.
- **Build-time pre-render:**
  - after `vite build`, a second `vite build --ssr` renders `/` in Node with `renderToString`, using the same provider tree as the browser, so `hydrateRoot` attaches without a mismatch
  - `scripts/prerender.mjs` writes `index.html` (pre-rendered, indexable), `app.html` (empty shell, `noindex`) and `shortlist.html` (`noindex`, with its own WhatsApp preview)
  - `vercel.json` serves real files first, then rewrites `/s/*` and everything else to the right shell
- **Meta and crawl control:** title, description, canonical, Open Graph and Twitter tags with a 1200×630 JPEG (70 KB; WhatsApp ignores images over ~300 KB), JSON-LD `WebApplication` naming the author, `robots.txt` and `sitemap.xml`.

**Measured** with Lighthouse on a production build, simulated mobile:

| | Performance | Accessibility | Best practices | SEO |
|---|---:|---:|---:|---:|
| First pass | 63 | 95 | 100 | 100 |
| After fixes | 99 | 100 | 100 | 100 |

**The fixes:**
- **Code splitting:** `React.lazy` for every app screen took the main bundle from 895 KB to 301 KB. The dashboard's chart library (360 KB) now loads only for admins who open it.
- **Images:** `srcset` with 800 px variants, so phones don't download 1600 px screenshots.
- **Caching:** `Cache-Control: immutable` for content-hashed `/assets`.
- **Contrast:** the green CTA's white text was 3.8:1 against the background, so it moved one shade darker.

First contentful paint went from 5.7 s to 1.5 s, and layout shift is 0.

**Gotchas:**
- Pre-rendering requires the component tree to be free of browser globals while rendering. `ThemeProvider` read `window.matchMedia` outside a guard, which would have crashed the Node render.
- Hydration only works if the server and the browser render the identical tree, including providers that add DOM, like the toast region. That's why both use a shared `Root.jsx`.
