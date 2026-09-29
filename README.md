# Brokery CRM

[![CI](https://github.com/AbhiEE03/Brokery-web/actions/workflows/ci.yml/badge.svg)](https://github.com/AbhiEE03/Brokery-web/actions/workflows/ci.yml)

A role-based CRM for small real-estate brokerages: brokers manage their clients and property inventory, and changes to money-affecting fields (deal stage, budgets, asking price) go through an admin approval step instead of applying silently.

**Frontend:** https://brokery-ruddy.vercel.app  
**Backend API:** https://brokery-api.onrender.com

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
- **Analytics dashboard** — MongoDB aggregation endpoints for pipeline distribution, broker conversion, monthly closures and available inventory by city, rendered with Recharts.
- **Client–property links** — brokers record which client is interested in which property and how strongly (manual links; see Roadmap for automated matching).
- **Readable codes** — clients get `CL-000001`-style codes; properties get `00AA → 00AB → … → 01AA` codes.
- **Activity log** — create/update actions on clients and properties and approval decisions are recorded with the acting user.
- **Uploads** — client documents (PDF/images) and property images are stored on Cloudinary; file types are verified by content signature, 5 MB limit.
- **Reliable notifications** — approval outcomes are written to a transactional outbox and emailed by a background worker with retries and exponential backoff, so SMTP problems never block or roll back an approval.
- **Operational basics** — structured JSON logs with request IDs, consistent JSON error responses, Helmet security headers, per-IP API rate limits and per-account login throttling, `/healthz` and `/readyz` probes, env validation at boot, graceful shutdown.

## Roadmap

Work in progress, in order:

1. Stage-history based analytics, indexes, pagination and a published benchmark
2. Tamper-evident audit log and duplicate-client ownership protection
3. Explainable client↔property matching and buyer shortlist links

---

## Tech Stack

**Frontend:** React, Redux Toolkit, Axios, Tailwind CSS, Recharts, Vite  
**Backend:** Node.js, Express, MongoDB, Mongoose, JWT, Nodemailer, Cloudinary  
**Infra:** Render (backend), Vercel (frontend), MongoDB Atlas

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

```bash
cd backend && npm test    # Jest + Supertest against an in-memory MongoDB replica set
cd frontend && npm test   # Vitest + React Testing Library
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
