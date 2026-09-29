# Brokery CRM

[![CI](https://github.com/AbhiEE03/Brokery-web/actions/workflows/ci.yml/badge.svg)](https://github.com/AbhiEE03/Brokery-web/actions/workflows/ci.yml)

A role-based CRM for small real-estate brokerages: brokers manage their clients and property inventory, and changes to money-affecting fields (deal stage, budgets, asking price) go through an admin approval step instead of applying silently.

**Frontend:** https://brokery-ruddy.vercel.app  
**Backend API:** https://brokery-api.onrender.com

### Highlights

- **Maker-checker approvals that stay correct under concurrency:** each approval applies exactly once, with transactional stale-write detection. Tested with parallel approvals.
- **Tamper-evident audit log:** hash-chained entries written in the same transaction as each change, with a verify endpoint that pinpoints the first edited entry.
- **Client ownership protection:** a unique index on normalised phone numbers makes "who registered this buyer first" provable, even when two brokers submit at the same instant.
- **Object-level authorization:** one policy module and a table-driven test of every endpoint × role.
- **Measured performance:** 6–10× faster list and report queries on 100k synthetic clients after adding query-driven indexes (see [Performance](#performance)).
- **Tests and CI:** 178 backend tests against a real in-memory MongoDB replica set, 18 frontend tests and a browser end-to-end test, all run in CI on every pull request.

---

## Demo Credentials

| Role   | Email               | Password       |
| ------ | ------------------- | -------------- |
| Broker | shubham@brokery.com | Broker@Shubham |
| Broker | harshit@brokery.com | Broker@Harshit |
| Broker | naresh@brokery.com  | Broker@Naresh  |

> Admin credentials are not public. Request access directly if needed.

---

## Features

- **Roles & object-level authorization** — Admin and Broker. A single policy module decides who can read/update/upload/delete each resource: brokers only access their own clients and the matches involving them; property inventory is shared for reading but only the broker who listed a property (or an admin) can change it. Enforced by route middleware and covered by a table-driven authorization test.
- **Validated input** — every body and query is parsed with Zod; server-controlled fields (stage, status, codes) can't be set by clients.
- **Approval engine** — low-risk fields (phone, notes, locality…) update immediately; sensitive fields (pipeline stage, budget, city, asking price…) become a change request for admin review, for both clients and properties. Unchanged values are ignored, approval is transactional and exactly-once under concurrent clicks, and a request whose field changed in the meantime is flagged as a conflict instead of overwriting newer data. See [ADR 001](docs/adr/001-approval-engine.md).
- **Event-based analytics** — every stage change is recorded as a `StageTransition` event in the same transaction, so the dashboard shows closures by the month they actually happened, a pipeline funnel, median days in each stage, and broker conversion as closed ÷ (closed + lost). See [ADR 002](docs/adr/002-soft-delete-and-stage-history.md). History for clients that existed before stage tracking was added is backfilled as a single entry per client, so older funnel and time-in-stage figures are approximate.
- **Data lifecycle** — soft deletes with a transactional cascade (links removed, pending approvals closed), atomic sequence counters for client/property codes, versioned migrations in `backend/migrations`.
- **Client–property links** — brokers record which client is interested in which property and how strongly (manual links; see Roadmap for automated matching).
- **Readable codes** — clients get `CL-000001`-style codes; properties get `00AA → 00AB → … → 01AA` codes, reserved from atomic counters so concurrent creates never collide.
- **Property search** — relevance-ranked full-text search on title and locality (text index), falling back to substring matching for partial words and property codes.
- **Tamper-evident audit log** — every change, upload, approval decision, account event and login is recorded with before/after values, the actor and the request id, inside the same transaction as the change. Entries are hash-chained (`sha256(prevHash + entry)`), and `GET /api/activity/verify` pinpoints the first edited or missing entry. Filterable by entity, broker and date, with keyset pagination. See [ADR 003](docs/adr/003-audit-log-and-ownership.md).
- **Client ownership protection** — phone numbers are normalised (`098765 43210` = `+91-98765-43210`) and unique among live clients via a database index, so two brokers can't both register the same buyer, even at the same instant. The second broker learns only that the client exists; an ownership claim goes to the admin with the audit entry proving who registered first, and the admin keeps or transfers the client.
- **Uploads** — client documents (PDF/images) and property images are stored on Cloudinary; file types are verified by content signature, 5 MB limit.
- **Reliable notifications** — approval outcomes are written to a transactional outbox and emailed by a background worker with retries and exponential backoff, so SMTP problems never block or roll back an approval.
- **Frontend** — React 19 + React Query:
  - Role-aware routing: brokers land on their clients, and admin screens are guarded.
  - An expired session signs the user out.
  - Edit forms send only the fields you changed and show which of them will need approval *before* you save, using rules from `GET /api/meta/edit-policies` rather than copies in the UI.
  - Each client and property shows its history from the audit log.
  - The approval queue has Pending / Conflicts / History tabs, with a side-by-side "requester saw → now → requested" view for conflicts.
  - Accessible confirmation dialogs; prices shown in ₹ lakh/crore.
- **Operational basics** — structured JSON logs with request IDs, consistent JSON error responses, Helmet security headers, per-IP API rate limits and per-account login throttling, `/healthz` and `/readyz` probes, env validation at boot, graceful shutdown.

## Performance

`npm run bench` (in `backend/`) generates a synthetic dataset (100k clients, 30k properties, 50k matches, 100k activity entries) in an in-memory replica set, then measures each endpoint with and without the schema indexes. Latest run, p50 latency ([full table and machine details](backend/bench/results/2026-09-29.md)):

| Endpoint | No indexes | Indexed |
|---|---:|---:|
| Broker's client list | 202 ms | 30 ms |
| Clients by stage (admin) | 239 ms | 45 ms |
| Property search (text index vs substring scan) | 171 ms | 27 ms |
| Closures by month | 245 ms | 26 ms |
| Activity feed, 40k rows deep: offset / keyset | 408 / 203 ms | 89 / 52 ms |
| Dashboard summary (full-collection aggregation) | 161 ms | 167 ms |

Single laptop run with the database on the same machine; read it as before/after, not as production capacity. Full-collection aggregations don't benefit from indexes. Pre-aggregating them is the next step (see `docs/ENGINEERING_LOG.md`).

## Roadmap

Work in progress, in order:

1. Explainable client↔property matching and buyer shortlist links
2. Event-driven re-match alerts when a property's price or status changes

---

## Tech Stack

**Frontend:** React 19, React Query, Redux Toolkit, React Router, Axios, Tailwind CSS, Recharts, Vite  
**Backend:** Node.js, Express 5, MongoDB (transactions on a replica set), Mongoose, Zod, JWT, pino, Helmet, Nodemailer, Cloudinary, migrate-mongo  
**Testing:** Jest + Supertest + mongodb-memory-server, Vitest + React Testing Library, Playwright, autocannon (benchmarks)  
**Infra:** GitHub Actions (CI), Render (backend), Vercel (frontend), MongoDB Atlas

## Project structure

```text
backend/
  app.js, server.js       Express app (importable by tests) and process entry point
  routes/ controllers/    HTTP layer: loadResource → authorize → validate → handler
  services/               approval engine, audit log, ownership claims, lifecycle, notifications
  policies/               who can do what, in one place
  validation/             Zod schemas for every body and query
  models/                 Mongoose schemas (soft delete plugin, indexes)
  migrations/             versioned, idempotent data migrations
  workers/                outbox worker that sends notification emails
  tests/                  Jest suites, including the authorization matrix and concurrency tests
  bench/                  synthetic data + autocannon benchmark
frontend/
  src/pages/              screens (clients, properties, approvals, claims, dashboard…)
  src/hooks/queries.js    React Query hooks per resource
  e2e/                    Playwright end-to-end test
docs/
  adr/                    design decisions (approval engine, soft delete & stage history, audit log & ownership)
  ENGINEERING_LOG.md      bugs found, how they were found, how they were fixed
```

## Design docs

- [ADR 001 — Approval engine](docs/adr/001-approval-engine.md): exactly-once approvals, stale detection, transactional outbox
- [ADR 002 — Soft delete, stage history and atomic codes](docs/adr/002-soft-delete-and-stage-history.md)
- [ADR 003 — Audit log and ownership protection](docs/adr/003-audit-log-and-ownership.md)
- [Engineering log](docs/ENGINEERING_LOG.md): the authorization holes, race conditions and UI bugs found, and how each was fixed and tested

---

## Local Setup

```bash
# Clone the repo
git clone https://github.com/AbhiEE03/Brokery-web.git
cd Brokery-web

# Backend
cd backend
cp .env.example .env
# Fill in your values in .env
npm install
npm run dev

# Frontend (new terminal)
cd frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:5000/api
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:5000`.

### Sandbox mode (no database setup needed)

```bash
cd backend
npm run dev:sandbox
```

Starts the API on `http://localhost:5000` against a throwaway in-memory MongoDB replica set, seeded with demo data. Uploads go to `backend/.dev-uploads/` and emails are logged instead of sent. It never touches the database configured in `.env`.

### Tests

CI (GitHub Actions) runs three jobs on every pull request and every push to `main`:
- **backend:** 178 Jest tests, including the authorization matrix, parallel-approval races, audit-chain tamper detection and simultaneous duplicate registrations.
- **frontend:** lint, 18 Vitest tests and a production build.
- **e2e:** a Playwright test of the core flow in a real browser.

```bash
cd backend && npm test    # Jest + Supertest against an in-memory MongoDB replica set
cd frontend && npm test   # Vitest + React Testing Library
cd frontend && npm run e2e   # Playwright: broker proposes → admin approves → broker sees it
                             # (starts the sandbox API + Vite; set PW_CHANNEL=msedge or chrome to use an installed browser)
```

### Using a real MongoDB

The approval engine uses multi-document transactions, which need a **replica set**. MongoDB Atlas clusters already are one. For a local `mongod`, start it once as a single-node replica set:

```bash
mongod --replSet rs0 --dbpath ./data
mongosh --eval "rs.initiate()"
# MONGO_URI=mongodb://localhost:27017/brokery?replicaSet=rs0
```

Schema changes ship as migrations (`backend/migrations`, run with `npm run migrate:up` after a backup).

### Seeding a real database

Seed a **development** database with demo data (wipes existing data; refuses to run with `NODE_ENV=production`):

```bash
cd backend
ADMIN_PASSWORD='<choose one>' node scripts/seed.js
```
