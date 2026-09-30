# ADR 005 — Transactional outbox and re-match alerts

**Status:** Accepted (2026-09-30)

## Context

When a listing's price drops or it comes back on the market, buyers it now suits go unnoticed, because nobody re-checks. The app already had the pieces:
- the approval engine, which applies property changes
- matching, which scores client–property pairs
- a background worker, which sends emails

Nothing connected them.

## Decision

**1. Record the change and the event together.** Whenever a property is created, or one of the fields matching reads changes (price, status, size, bedrooms, type, city, locality), the same transaction writes an `OutboxEvent` of type `PropertyChanged`. It holds matching snapshots of the property before and after the change. All three write paths do this: direct admin edits, approved change requests, and new listings.

Writing both in one transaction is the point of the outbox pattern:
- **No lost events:** if the change commits, the event exists, even if the process dies right after the commit.
- **No phantom events:** if the change rolls back, so does the event.

Publishing to a queue *after* the commit couldn't guarantee the first; publishing *before* it couldn't guarantee the second.

**2. Process events with at-least-once delivery.** The existing in-process worker also drains `OutboxEvent`:
- It claims one event at a time with a conditional update (`queued` → `processing`), so two workers never process the same event at once.
- A failed event is retried with exponential backoff (30 s, 1 m, 2 m…) and marked `dead` after 5 attempts. Dead events stay in the collection for inspection.
- Events left in `processing` by a crash are put back in the queue after 5 minutes.
- After each commit, the event is also processed straight away, on a best-effort basis. The worker is only the safety net.

**3. Make the consumer idempotent.** At-least-once means an event can be processed twice, for example after a crash between writing alerts and marking the event done. `Alert` has a unique index on `(eventId, client)`, and alerts are written as upserts with `$setOnInsert`, so a second pass inserts nothing.

**4. Alert on crossings, not on every match.** For each active client the property now suits (the same candidate query that matching uses), the property is scored before and after the change.
- An alert fires only if the score **crosses** the threshold: below 0.6 before, and at least 0.6 after.
- **The "before" rule:** a state the client would never have been shown (not available, another city or type, more than 10% over budget) counts as 0, however well it matched otherwise.
- Without that rule, a perfect listing 20% over budget would score about 0.65 on locality, bedrooms and freshness alone. Its price dropping into budget would then look like "no change" instead of the moment it became relevant. A test covers this case.

**5. Poll instead of pushing.** The frontend polls `GET /api/alerts` every 60 seconds and shows an unread badge. Polling is stateless, fits a single Render instance, and alerts aren't urgent to the second. WebSockets or server-sent events would be worth it for sub-second latency, presence features, or high fan-out.

## Why not Kafka, RabbitMQ or Redis?

At this scale (one API instance, tens of events a day), a MongoDB collection is the queue. It's already there, it's already transactional with the data, and it gives inspection and replay for free. A broker would add infrastructure and still need an outbox for the same no-loss guarantee. The next step up, if volume demanded it, would be a change-stream or log-tailing relay from this outbox table to a broker. The table itself would stay.

## Operational visibility

`/readyz` reports `outbox.oldestPendingSeconds`. It returns `status: "degraded"` when an event has waited more than 15 minutes, but still answers 200. A lagging worker shouldn't take the API out of rotation, but the number shows when events aren't being processed.

## Ordering

Events are processed oldest-first, and each carries its own before/after snapshots rather than reading the property's current state. Processing them slightly out of order can't produce a wrong crossing: each crossing is judged only against its own change.
