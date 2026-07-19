# Brokery CRM

## What it does

- Role-based access for Admin and Broker — enforced at middleware level, not just the UI
- Sensitive field edits (pipeline stage, budget) don't apply directly — they create a ChangeRequest that admin reviews with a before/after diff. Low-risk fields like phone and notes update immediately
- Dashboard pulls live data from 5 MongoDB aggregation queries — broker performance, pipeline breakdown, closed deals by month, inventory by city
- Properties get auto-assigned alphanumeric codes (00AA → 00AB → ... → 01AA) on creation
- Every write action is logged automatically — actor, entity type, timestamp — without blocking the response
- Client documents and property images upload to Cloudinary via Multer
- Email goes out via Nodemailer when a ChangeRequest gets approved or rejected

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

- **RBAC** — Admin and Broker roles with protected routes and middleware-level enforcement
- **Two-tier edit approval** — sensitive fields (pipeline stage, budget) create a ChangeRequest routed to admin with visual diff; low-risk fields (phone, notes) update directly
- **Analytics Dashboard** — 5 MongoDB aggregation endpoints powering live charts (broker performance, pipeline distribution, deals by month, inventory by city)
- **Property Matching Engine** — links client requirements to properties via interest-level flags
- **Alphanumeric Code Generator** — auto-increments property codes (00AA → 00AB → ... → 01AA) with collision-safe max-query increment
- **Activity Log** — middleware wraps res.json to asynchronously record every write action with actor, entity, and timestamp
- **Cloudinary Uploads** — client documents and property images via Multer middleware
- **Email Notifications** — Nodemailer sends alerts on ChangeRequest resolution

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

Seed the database with demo data:

```bash
cd backend
node scripts/seed.js
```
