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
