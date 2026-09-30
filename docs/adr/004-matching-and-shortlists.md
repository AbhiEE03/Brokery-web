# ADR 004 — Explainable matching and buyer shortlist links

**Status:** Accepted (2026-09-30)

## 1. Matching

**Context.** Brokers linked clients to properties by hand from memory. The app knew each client's budget, city, locality, size and bedrooms, but never used them.

**Decision.** `services/matchingService.js` recommends properties in three steps:

1. **Candidates.** One indexed query finds properties in the client's city that are `available`, of the client's property type if set, and priced at most 10% over the maximum budget. It skips properties already linked or dismissed for this client and stops at 500 candidates. It uses the existing `{ status, location.cityKey, createdAt }` index.
2. **Scoring.** A weighted sum of five features, each between 0 and 1. The weights live in `config/matchingWeights.js` and add up to 1, so a score is a percentage.

   | Feature | Weight | 1.0 when | Falls off |
   |---|---:|---|---|
   | Budget | 0.35 | price is within the client's range | linearly to 0 at 10% over; to 0 at 50% under the minimum |
   | Locality | 0.20 | same locality (case-insensitive, substring) | 0 otherwise |
   | Size | 0.15 | area is within the range | to 0 at 20% outside |
   | Bedrooms | 0.15 | exact BHK | 0.5 at ±1, 0 beyond |
   | Freshness | 0.15 | listed today | halves every 30 days |

   A client with no preference for a feature gets a neutral 0.5 on it. Every feature also returns a reason, e.g. "Price ₹94.5 L is 5% over the ₹90 L budget", so the UI shows why a property ranks where it does.
3. **Top-k.** A size-k min-heap (`utils/topK.js`) picks the best k in O(n log k) instead of sorting all n.

The same scorer runs in reverse: `GET /api/properties/:id/interested-clients` returns the active clients a listing suits. Brokers only ever see their own clients there.

**Feedback.** Linking a recommendation or marking it "not a fit" is stored as a `RecommendationEvent`. A dismissed property never comes back for that client. These events, together with buyer reactions on shortlist links, are the implicit feedback matching quality can later be measured against.

**Evaluation.** `npm run match:export` writes a labelling set: 30 clients × 15 same-city properties in random order, with no names, phones or emails. A person grades each pair 0/1/2. `npm run match:eval` then reports precision@5 and NDCG@10 on held-out clients for four rankers:
- random order
- price distance from the budget midpoint
- the scorer with default weights
- the scorer with weights tuned on the other two-thirds of clients (a grid search over 1,001 weight vectors)

No numbers are published yet, because the grades have to come from a person, not be made up.

**Why not machine learning?** There's no historical data to train on, and a broker has to trust and explain each recommendation. A transparent weighted score with reasons fits both. The event data being collected now is what a learned ranker would need later.

## 2. Buyer shortlist links

**Context.** Brokers send properties to buyers on WhatsApp and lose track of which ones they liked.

**Decision.**
- A broker picks properties and gets one URL (`/s/<token>`) that expires after 3–30 days, 7 by default, and can be revoked.
- The buyer opens it without an account and reacts to each property: love it, book a visit, or not for me. A note is optional.
- Each reaction updates the client's match (like/visit → high interest, dislike → low), writes an audit entry and alerts the broker in the app.

**Security:**
- **Token:** 32 random bytes, base64url-encoded. Only its **SHA-256** is stored, so a copy of the database can't open anyone's link. The URL is shown exactly once.
- **Uniform 404:** malformed, unknown, expired and revoked tokens all get the same 404 with the same message. A 401 or a distinct message would confirm that a link exists.
- **Allow-listed response:** the public view contains only title, type, status, city, locality, price, specs and image URLs. It never includes dealer contacts, notes, codes, the client's surname or contact details. A test fails if any of those appear.
- **Scope:** a link can only carry feedback about its own properties.
- **Rate limits and caching:** limited per IP and per link (so one leaked URL can't be hammered from many addresses). Responses carry `Cache-Control: no-store`, the API adds `X-Robots-Tag: noindex`, and the page adds a robots `noindex` meta tag.
- **Idempotent feedback:** there is one feedback row per (link, property). Repeating the same reaction changes nothing, and doesn't audit or alert twice.

**Consequences:**
- Buyer actions show up in the audit log with no actor (`meta.via = "buyer-link"`). The UI labels them "Buyer, via shortlist link".
- Opens are counted per link, so a broker can see whether the buyer has looked yet.
