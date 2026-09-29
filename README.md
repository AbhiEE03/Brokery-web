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

- **Roles** — Admin and Broker. Admin-only routes (analytics, user registration, deletes, approvals) are enforced by backend middleware; brokers only see their own clients.
- **Two-tier edits** — low-risk fields (phone, notes, locality…) update immediately; sensitive fields (pipeline stage, budget, city, asking price…) create a change request that an admin approves or rejects with a before/after view. Field rules live in `backend/utils/*EditRules.js`.
- **Analytics dashboard** — MongoDB aggregation endpoints for pipeline distribution, broker conversion, monthly closures and available inventory by city, rendered with Recharts.
- **Client–property links** — brokers record which client is interested in which property and how strongly (manual links; see Roadmap for automated matching).
- **Readable codes** — clients get `CL-000001`-style codes; properties get `00AA → 00AB → … → 01AA` codes.
- **Activity log** — create/update actions on clients and properties and approval decisions are recorded with the acting user.
- **Uploads** — client documents (PDF/images) and property images are stored on Cloudinary; file types are verified by content signature, 5 MB limit.
- **Email** — the requesting broker is emailed when their change request is approved or rejected.

## Roadmap

Work in progress, in order:

1. Automated test suite (authorization matrix, approval flows) + CI
2. Object-level authorization and request validation on every endpoint
3. A single, transactional approval engine for clients **and** properties, with stale-change detection
4. Platform hardening (central error handling, rate limiting, structured logs, health checks)
5. Stage-history based analytics, indexes, pagination and a published benchmark
6. Tamper-evident audit log and duplicate-client ownership protection
7. Explainable client↔property matching and buyer shortlist links

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

### Seeding a real database

Seed a **development** database with demo data (wipes existing data; refuses to run with `NODE_ENV=production`):

```bash
cd backend
ADMIN_PASSWORD='<choose one>' node scripts/seed.js
```
