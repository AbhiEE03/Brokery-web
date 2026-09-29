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

**Fix:** Phase 2 (see below).

### Fix (Phase 2)

- One policy module (`backend/policies/index.js`) defines who can read/update/upload/link/delete each resource type.
- Routes now run `loadResource → authorize(action) → validate → handler`. On upload routes authorization runs **before** Multer, so a rejected request never stores a file.
- Request bodies and queries are parsed with Zod schemas (`backend/validation/schemas.js`). Create schemas whitelist fields, so `pipelineStage`, `status`, codes and timestamps can't be set by the client. Pagination is bounded (`1 ≤ limit ≤ 100`); malformed ids and queries return 400 instead of 500.
- Search input is escaped before being used in `$regex`.
- Login returns 401 for bad credentials, rejects non-string input, and disabled accounts are blocked at login and on every request.

**Result:** the authorization matrix has no known failures; `KNOWN_FAILURES` is empty and any new entry would be a regression.
