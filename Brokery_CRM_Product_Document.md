# Brokery CRM — Complete Product Document
**Version:** 1.0  
**Stack:** MERN (MongoDB · Express · React · Node.js)  
**Author:** Abhishek Kumar  
**Purpose:** Solo rebuild reference document — covers architecture, data models, API contracts, feature specs, seed data, and build order.

---

## 1. Product Overview

Brokery is a role-based CRM for real estate brokers to manage property inventory, client pipelines, broker assignments, and deal workflows. It is designed for small-to-medium brokerage firms operating in Indian metro cities.

### Two roles
| Role | What they can do |
|---|---|
| **Admin** | Full access — manage brokers, approve/reject change requests, view all analytics, export data |
| **Broker** | Manage own clients and assigned properties, raise change requests for sensitive edits |

### Three original features (rebuilt)
1. RBAC with two-tier edit approval system
2. Property matching engine (client ↔ property via interest flags)
3. Alphanumeric property code generator + CSV migration pipeline

### Three new features (additions)
4. Dashboard analytics (MongoDB aggregation)
5. Email notifications via Nodemailer (on ChangeRequest resolution)
6. Activity log (every significant action timestamped)

---

## 2. Git Setup & .gitignore

### Root .gitignore (create this FIRST before `git init`)
```
# Dependencies
node_modules/
.pnp
.pnp.js

# Environment variables — NEVER commit these
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build output
dist/
build/

# Logs
logs/
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Vite
*.local

# Coverage
coverage/
```

### Git workflow rules
- **Always** create `.gitignore` before `git init`
- **Never** commit `.env` — only `.env.example`
- **Never** commit `node_modules/` — only `package.json`
- Commit after every completed feature, not at end of day
- Commit message format: `type: short description`
  - `init:` — project setup
  - `feat:` — new feature
  - `fix:` — bug fix
  - `refactor:` — code restructure, no feature change
  - `chore:` — deps, config, tooling
  - `docs:` — README, comments

### Initial repo setup
```bash
# 1. Create .gitignore first (copy from above)
# 2. Then:
git init
git add .
git commit -m "init: project setup with express server and dependencies"
git remote add origin https://github.com/AbhiEE03/Brokery.git
git branch -M main
git push -u origin main
```

---

## 3. Folder Structure

```
brokery/
├── backend/
│   ├── config/
│   │   ├── db.js                  # Mongoose connect
│   │   └── cloudinary.js          # Cloudinary SDK init
│   ├── models/
│   │   ├── User.js
│   │   ├── Client.js
│   │   ├── Property.js
│   │   ├── Match.js
│   │   ├── ClientChangeRequest.js
│   │   ├── PropertyChangeRequest.js
│   │   └── ActivityLog.js         # NEW
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── clientController.js
│   │   ├── propertyController.js
│   │   ├── matchController.js
│   │   ├── changeRequestController.js
│   │   ├── analyticsController.js # NEW
│   │   └── activityController.js  # NEW
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── clientRoutes.js
│   │   ├── propertyRoutes.js
│   │   ├── matchRoutes.js
│   │   ├── changeRequestRoutes.js
│   │   ├── analyticsRoutes.js     # NEW
│   │   └── activityRoutes.js      # NEW
│   ├── middleware/
│   │   ├── authMiddleware.js      # verifyToken, requireAdmin, requireBroker
│   │   ├── uploadMiddleware.js    # Multer + Cloudinary
│   │   └── logActivity.js         # NEW — middleware to auto-log actions
│   ├── utils/
│   │   ├── codeGenerator.js       # Alphanumeric code logic
│   │   ├── emailService.js        # NEW — Nodemailer wrapper
│   │   └── clientEditRules.js     # Field-level edit permission map
│   ├── scripts/
│   │   ├── seed.js                # Fake data seeder
│   │   └── csvMigrate.js          # CSV → MongoDB migration
│   ├── .env.example
│   └── server.js
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/                   # Axios instance + per-resource API fns
│   │   │   ├── axiosInstance.js
│   │   │   ├── authApi.js
│   │   │   ├── clientApi.js
│   │   │   ├── propertyApi.js
│   │   │   ├── matchApi.js
│   │   │   ├── changeRequestApi.js
│   │   │   └── analyticsApi.js
│   │   ├── store/                 # Redux slices
│   │   │   ├── store.js
│   │   │   ├── authSlice.js
│   │   │   ├── clientSlice.js
│   │   │   └── propertySlice.js
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── TopBar.jsx
│   │   │   │   └── ProtectedRoute.jsx
│   │   │   ├── ui/                # Reusable: Button, Badge, Modal, Table
│   │   │   └── charts/            # Recharts wrappers
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx      # NEW — analytics page
│   │   │   ├── Clients.jsx
│   │   │   ├── ClientDetail.jsx
│   │   │   ├── Properties.jsx
│   │   │   ├── PropertyDetail.jsx
│   │   │   ├── Matches.jsx
│   │   │   ├── ChangeRequests.jsx
│   │   │   └── ActivityLog.jsx    # NEW
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── utils/
│   │   │   └── formatters.js      # Currency, date, status formatters
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── vite.config.js
│
└── README.md
```

---

## 4. Data Models

### 3.1 User
```js
{
  name:        String, required
  email:       String, required, unique
  password:    String, required          // bcrypt hashed
  role:        enum ['admin', 'broker'], default: 'broker'
  isActive:    Boolean, default: true
  createdAt:   Date
}
```

### 3.2 Client
```js
{
  clientCode:     String, unique         // Auto: CL-000001, CL-000002 ...
  name:           String, required
  phone:          String, required
  email:          String
  assignedBroker: ObjectId → User
  pipelineStage:  enum ['lead', 'contacted', 'site_visit', 'negotiation', 'closed', 'lost']
                  default: 'lead'

  // Buyer requirements
  requirements: {
    propertyType:  enum ['flat', 'villa', 'plot', 'commercial']
    city:          String
    locality:      String
    minBudget:     Number
    maxBudget:     Number
    minArea:       Number               // sq ft
    maxArea:       Number
    bedrooms:      Number
  }

  documents: [{
    name:    String
    url:     String                     // Cloudinary URL
    type:    enum ['id_proof', 'income_proof', 'agreement', 'other']
    uploadedAt: Date
  }]

  notes:      String
  createdAt:  Date
  updatedAt:  Date
}
```
> **clientCode logic:** Counter schema with pre-save hook — read max existing code, increment, format as `CL-XXXXXX`.

### 3.3 Property
```js
{
  propertyCode:  String, unique          // Auto: 00AA, 00AB ... 00ZZ, 01AA ...
  title:         String, required
  propertyType:  enum ['flat', 'villa', 'plot', 'commercial']
  status:        enum ['available', 'under_negotiation', 'sold', 'withdrawn']
                 default: 'available'

  location: {
    city:      String, required          // Delhi, Mumbai, Bangalore, Hyderabad, Pune
    locality:  String
    sector:    String
    pincode:   String
  }

  pricing: {
    askingPrice:  Number                 // in INR
    pricePerSqft: Number
  }

  specs: {
    area:      Number                    // sq ft
    bedrooms:  Number
    bathrooms: Number
    floor:     Number
    totalFloors: Number
    parking:   Boolean
    furnished: enum ['unfurnished', 'semi-furnished', 'fully-furnished']
  }

  dealer: {
    name:  String
    phone: String
    email: String
  }

  images:     [String]                   // Cloudinary URLs
  documents:  [String]                   // Cloudinary URLs
  
  addedBy:    ObjectId → User
  createdAt:  Date
  updatedAt:  Date
}
```
> **propertyCode logic:** in `utils/codeGenerator.js`. Base-26 encoding on letters, 2-digit numeric prefix. `00AA → 00AB → ... → 00ZZ → 01AA`. On new property creation, query `MAX(propertyCode)`, decode, increment, encode.

### 3.4 Match
```js
{
  client:        ObjectId → Client, required
  property:      ObjectId → Property, required
  interestLevel: enum ['high', 'medium', 'low'], required
  notes:         String
  createdBy:     ObjectId → User
  createdAt:     Date
}
// Compound index: { client: 1, property: 1 } unique: true
```

### 3.5 ClientChangeRequest
```js
{
  client:       ObjectId → Client, required
  requestedBy:  ObjectId → User, required
  status:       enum ['pending', 'approved', 'rejected'], default: 'pending'
  
  changes: [{
    field:    String               // e.g. 'pipelineStage', 'requirements.maxBudget'
    oldValue: Mixed
    newValue: Mixed
  }]

  adminNote:    String             // Rejection reason etc.
  resolvedBy:   ObjectId → User
  resolvedAt:   Date
  createdAt:    Date
}
```

### 3.6 PropertyChangeRequest
```js
// Identical structure to ClientChangeRequest but references Property
{
  property:     ObjectId → Property, required
  requestedBy:  ObjectId → User, required
  status:       enum ['pending', 'approved', 'rejected'], default: 'pending'
  changes: [{ field, oldValue, newValue }]
  adminNote:    String
  resolvedBy:   ObjectId → User
  resolvedAt:   Date
  createdAt:    Date
}
```

### 3.7 ActivityLog (NEW)
```js
{
  performedBy:  ObjectId → User, required
  action:       String, required         // Human-readable: "Added client Rahul Sharma"
  entity:       enum ['client', 'property', 'match', 'change_request', 'user']
  entityId:     ObjectId                 // The affected document's _id
  metadata:     Mixed                    // Any extra context as key-value
  createdAt:    Date
}
// Index: { createdAt: -1 } for fast recent-first queries
// Index: { performedBy: 1, createdAt: -1 } for per-broker logs
```

---

## 5. clientEditRules.js — Two-Tier Edit Logic

This file is the heart of the approval system. It defines which fields a broker can edit directly vs. which require admin approval.

```js
// utils/clientEditRules.js

const DIRECT_EDIT_FIELDS = [
  'notes',
  'email',
  'phone',
  'requirements.locality',
  'requirements.propertyType',
  'requirements.bedrooms',
];

const APPROVAL_REQUIRED_FIELDS = [
  'pipelineStage',
  'assignedBroker',
  'requirements.minBudget',
  'requirements.maxBudget',
  'requirements.city',
  'requirements.minArea',
  'requirements.maxArea',
];

module.exports = { DIRECT_EDIT_FIELDS, APPROVAL_REQUIRED_FIELDS };
```

**Controller logic for PATCH /clients/:id:**
```
1. Separate incoming fields into directFields and sensitiveFields
   using clientEditRules
2. If directFields → apply immediately with Client.findByIdAndUpdate()
3. If sensitiveFields → create ClientChangeRequest document with
   { field, oldValue (read from DB), newValue } for each field
4. Return { updated: directResult, pending: changeRequest }
```

Same pattern applies for properties using `propertyEditRules.js`.

---

## 6. API Reference

### Auth
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Returns JWT |
| GET | `/api/auth/me` | Any auth | Returns current user |
| POST | `/api/auth/register` | Admin only | Create broker account |

### Clients
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/api/clients` | Admin: all / Broker: own | List with filters |
| POST | `/api/clients` | Admin, Broker | Create client (auto clientCode) |
| GET | `/api/clients/:id` | Assigned broker or Admin | Client detail |
| PATCH | `/api/clients/:id` | Assigned broker or Admin | Two-tier edit |
| DELETE | `/api/clients/:id` | Admin only | Soft delete |
| POST | `/api/clients/:id/documents` | Assigned broker | Upload document |

**Query params for GET /clients:**  
`?stage=negotiation&city=Delhi&broker=<id>&search=rahul&page=1&limit=20`

### Properties
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/api/properties` | Any auth | List with filters |
| POST | `/api/properties` | Admin, Broker | Create (auto propertyCode) |
| GET | `/api/properties/:id` | Any auth | Property detail |
| PATCH | `/api/properties/:id` | Two-tier, same as clients | Edit |
| DELETE | `/api/properties/:id` | Admin only | |
| POST | `/api/properties/:id/images` | Admin, Broker | Cloudinary upload |

**Query params for GET /properties:**  
`?city=Mumbai&type=flat&status=available&minPrice=5000000&maxPrice=20000000&minArea=800&page=1&limit=20`

### Matches
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/api/matches` | Any auth | All matches |
| POST | `/api/matches` | Admin, Broker | Link client ↔ property |
| PATCH | `/api/matches/:id` | Creator or Admin | Update interest level |
| DELETE | `/api/matches/:id` | Creator or Admin | Remove match |
| GET | `/api/matches/client/:clientId` | Any auth | All matches for a client |
| GET | `/api/matches/property/:propertyId` | Any auth | All matches for a property |

### Change Requests
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/api/change-requests` | Admin: all / Broker: own | List pending |
| GET | `/api/change-requests/:id` | Admin or requester | Detail with diff |
| PATCH | `/api/change-requests/:id/resolve` | Admin only | Approve or reject |

**Body for resolve:**
```json
{ "action": "approved" | "rejected", "adminNote": "optional reason" }
```
On approval → apply the changes to the target document.  
On either outcome → trigger email notification (see Section 7).

### Analytics (NEW)
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/api/analytics/summary` | Admin only | Top-level KPI cards |
| GET | `/api/analytics/deals-by-month` | Admin only | Monthly closed deals (last 12 months) |
| GET | `/api/analytics/pipeline-distribution` | Admin only | Clients per stage |
| GET | `/api/analytics/broker-performance` | Admin only | Deals closed per broker |
| GET | `/api/analytics/property-by-city` | Admin only | Inventory per city |

### Activity Log (NEW)
| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/api/activity` | Admin: all / Broker: own | Paginated log |
| GET | `/api/activity/entity/:entityId` | Admin or owner | Logs for one entity |

---

## 7. Analytics — MongoDB Aggregation Queries

These are the actual aggregation pipelines. Write these yourself — this is what you explain in interviews.

### 6.1 Summary KPIs
```js
// analyticsController.js → getSummary()
const [clientStats, propertyStats, pendingRequests] = await Promise.all([
  Client.aggregate([
    { $group: {
      _id: '$pipelineStage',
      count: { $sum: 1 }
    }}
  ]),
  Property.aggregate([
    { $group: {
      _id: '$status',
      count: { $sum: 1 }
    }}
  ]),
  ClientChangeRequest.countDocuments({ status: 'pending' })
]);

// Post-process to extract:
// totalClients, closedDeals (stage=closed), activeListings (status=available),
// pendingApprovals
```

### 6.2 Deals Closed by Month (last 12 months)
```js
// analyticsController.js → getDealsByMonth()
const twelveMonthsAgo = new Date();
twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

const data = await Client.aggregate([
  {
    $match: {
      pipelineStage: 'closed',
      updatedAt: { $gte: twelveMonthsAgo }
    }
  },
  {
    $group: {
      _id: {
        year:  { $year: '$updatedAt' },
        month: { $month: '$updatedAt' }
      },
      count: { $sum: 1 }
    }
  },
  { $sort: { '_id.year': 1, '_id.month': 1 } }
]);
// Returns array like: [{ _id: { year: 2025, month: 3 }, count: 4 }, ...]
// Frontend formats month number → "Mar 2025" for chart labels
```

### 6.3 Pipeline Distribution
```js
// Used for a pie/donut chart on Dashboard
const data = await Client.aggregate([
  { $group: { _id: '$pipelineStage', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

### 6.4 Broker Performance
```js
// Table: broker name | clients assigned | deals closed | conversion rate
const data = await Client.aggregate([
  {
    $group: {
      _id: '$assignedBroker',
      total: { $sum: 1 },
      closed: {
        $sum: { $cond: [{ $eq: ['$pipelineStage', 'closed'] }, 1, 0] }
      }
    }
  },
  {
    $lookup: {
      from: 'users',
      localField: '_id',
      foreignField: '_id',
      as: 'broker'
    }
  },
  { $unwind: '$broker' },
  {
    $project: {
      brokerName: '$broker.name',
      total: 1,
      closed: 1,
      conversionRate: {
        $round: [{ $multiply: [{ $divide: ['$closed', '$total'] }, 100] }, 1]
      }
    }
  },
  { $sort: { closed: -1 } }
]);
```

### 6.5 Property Inventory by City
```js
const data = await Property.aggregate([
  { $match: { status: 'available' } },
  { $group: { _id: '$location.city', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

---

## 8. Email Notifications — Nodemailer

### Setup
```js
// utils/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS    // Gmail App Password, not account password
  }
});

const sendChangeRequestResolved = async ({ toEmail, brokerName, entityType, action, adminNote, changes }) => {
  const subject = `Brokery CRM: Your ${entityType} edit request was ${action}`;
  
  const changesList = changes.map(c =>
    `<li><b>${c.field}:</b> ${c.oldValue} → ${c.newValue}</li>`
  ).join('');

  const html = `
    <h2>Change Request ${action.toUpperCase()}</h2>
    <p>Hi ${brokerName},</p>
    <p>Your edit request has been <b>${action}</b>.</p>
    <ul>${changesList}</ul>
    ${adminNote ? `<p><b>Admin note:</b> ${adminNote}</p>` : ''}
    <p>— Brokery CRM</p>
  `;

  await transporter.sendMail({
    from: `"Brokery CRM" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    html
  });
};

module.exports = { sendChangeRequestResolved };
```

### Where it's called
In `changeRequestController.js` → `resolveChangeRequest()`:
```js
// After applying/rejecting changes:
await sendChangeRequestResolved({
  toEmail:    requestedByUser.email,
  brokerName: requestedByUser.name,
  entityType: 'client',             // or 'property'
  action:     'approved',           // or 'rejected'
  adminNote:  req.body.adminNote,
  changes:    changeRequest.changes
});
```
> Wrap in try-catch — email failure should NOT fail the HTTP response.

---

## 9. Activity Log — Middleware Pattern

### logActivity middleware
```js
// middleware/logActivity.js
const ActivityLog = require('../models/ActivityLog');

const logActivity = (action, entity, getEntityId) => {
  return async (req, res, next) => {
    // Store original res.json
    const originalJson = res.json.bind(res);
    
    res.json = async (data) => {
      // Only log on success responses
      if (res.statusCode < 400) {
        try {
          await ActivityLog.create({
            performedBy: req.user._id,
            action: typeof action === 'function' ? action(req, data) : action,
            entity,
            entityId: getEntityId ? getEntityId(req, data) : null,
            metadata: { method: req.method, path: req.path }
          });
        } catch (err) {
          console.error('Activity log failed:', err.message);
          // Never block response for log failure
        }
      }
      return originalJson(data);
    };
    next();
  };
};

module.exports = logActivity;
```

### Usage on routes
```js
// clientRoutes.js
router.post('/',
  verifyToken,
  logActivity(
    (req, data) => `Created client ${data.data?.name}`,
    'client',
    (req, data) => data.data?._id
  ),
  createClient
);

router.patch('/:id/resolve', // change request
  verifyToken,
  requireAdmin,
  logActivity(
    (req) => `${req.body.action} change request`,
    'change_request',
    (req) => req.params.id
  ),
  resolveChangeRequest
);
```

---

## 10. Auth Middleware

```js
// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password').lean();
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required' });
  next();
};

const requireBroker = (req, res, next) => {
  if (!['admin', 'broker'].includes(req.user.role))
    return res.status(403).json({ message: 'Unauthorized' });
  next();
};

module.exports = { verifyToken, requireAdmin, requireBroker };
```

---

## 11. Seed Data

Fake but realistic Indian metro real estate data. Run with `node backend/scripts/seed.js`.

### Users seeded
```
Admin:   admin@brokery.com   / Admin@1234
Broker1: arjun@brokery.com   / Broker@1234   (Arjun Mehta)
Broker2: priya@brokery.com   / Broker@1234   (Priya Sharma)
Broker3: rohit@brokery.com   / Broker@1234   (Rohit Verma)
```

### Properties seeded (20 entries)
Spread across Delhi (Dwarka, Rohini, Vasant Kunj), Mumbai (Andheri, Powai, Bandra), Bangalore (Whitefield, Koramangala, HSR Layout), Hyderabad (Gachibowli, HITECH City).

Sample entries:
```
3BHK Flat   · Dwarka Sec-12, Delhi     · ₹85L   · 1450 sqft · Available   → 00AA
2BHK Flat   · Andheri West, Mumbai     · ₹1.2Cr · 980 sqft  · Available   → 00AB
Villa       · Whitefield, Bangalore    · ₹2.4Cr · 3200 sqft · Available   → 00AC
Commercial  · HITECH City, Hyderabad   · ₹3.1Cr · 5000 sqft · Available   → 00AD
Plot        · Rohini Sec-22, Delhi     · ₹45L   · 200 sqyd  · Available   → 00AE
2BHK Flat   · Powai, Mumbai            · ₹95L   · 890 sqft  · Sold        → 00AF
3BHK Flat   · Koramangala, Bangalore   · ₹1.8Cr · 1600 sqft · Negotiation → 00AG
... (13 more covering all cities and types)
```

### Clients seeded (15 entries)
```
CL-000001 · Rahul Sharma    · stage: closed      · broker: Arjun   · city: Delhi
CL-000002 · Neha Gupta      · stage: negotiation · broker: Priya   · city: Mumbai
CL-000003 · Amit Patel      · stage: site_visit  · broker: Rohit   · city: Bangalore
CL-000004 · Sunita Verma    · stage: contacted   · broker: Arjun   · city: Delhi
CL-000005 · Vikram Nair     · stage: lead        · broker: Priya   · city: Hyderabad
CL-000006 · Deepa Menon     · stage: closed      · broker: Arjun   · city: Bangalore
CL-000007 · Karan Malhotra  · stage: closed      · broker: Rohit   · city: Mumbai
... (8 more spread across stages and brokers)
```
> Having enough `closed` deals spread across months ensures the analytics charts render with real-looking data.

### Matches seeded
Link 8–10 client-property pairs with varied interest levels.

---

## 12. Property Code Generator

```js
// utils/codeGenerator.js

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Encode a 0-based number to 2-letter suffix
// 0 → AA, 1 → AB, ..., 25 → AZ, 26 → BA, ..., 675 → ZZ
const encodeLetters = (n) => {
  const first = Math.floor(n / 26);
  const second = n % 26;
  return LETTERS[first] + LETTERS[second];
};

// Decode letters back to number
const decodeLetters = (s) => {
  return LETTERS.indexOf(s[0]) * 26 + LETTERS.indexOf(s[1]);
};

const generateNextCode = async (Property) => {
  // Find the property with the lexicographically highest code
  const last = await Property.findOne({}, { propertyCode: 1 })
    .sort({ propertyCode: -1 })
    .lean();

  if (!last || !last.propertyCode) return '00AA';

  const numPrefix = parseInt(last.propertyCode.slice(0, 2));
  const letterSuffix = last.propertyCode.slice(2);
  const letterIndex = decodeLetters(letterSuffix);

  if (letterIndex < 675) {
    // Still room in current numeric prefix
    return String(numPrefix).padStart(2, '0') + encodeLetters(letterIndex + 1);
  } else {
    // Roll over: 00ZZ → 01AA
    return String(numPrefix + 1).padStart(2, '0') + 'AA';
  }
};

module.exports = { generateNextCode };
```

---

## 13. CSV Migration Script

```js
// scripts/csvMigrate.js
// Usage: node scripts/csvMigrate.js --file=./data/properties.csv

const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Property = require('../models/Property');
const { generateNextCode } = require('../utils/codeGenerator');
require('dotenv').config();

// Field mapping: CSV column → Mongoose field path
const FIELD_MAP = {
  'Property Title':   'title',
  'Type':             'propertyType',
  'City':             'location.city',
  'Locality':         'location.locality',
  'Price':            'pricing.askingPrice',
  'Area (sqft)':      'specs.area',
  'Bedrooms':         'specs.bedrooms',
  'Dealer Name':      'dealer.name',
  'Dealer Phone':     'dealer.phone',
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const rows = [];

  fs.createReadStream(process.argv[2].split('=')[1])
    .pipe(csv())
    .on('data', (row) => rows.push(row))
    .on('end', async () => {
      const docs = await Promise.all(rows.map(async (row) => {
        const doc = {};
        for (const [csvCol, mongoPath] of Object.entries(FIELD_MAP)) {
          if (row[csvCol]) {
            // Handle nested paths like 'location.city'
            const parts = mongoPath.split('.');
            if (parts.length === 1) {
              doc[parts[0]] = row[csvCol];
            } else {
              doc[parts[0]] = doc[parts[0]] || {};
              doc[parts[0]][parts[1]] = row[csvCol];
            }
          }
        }
        doc.propertyCode = await generateNextCode(Property);
        doc.status = 'available';
        return doc;
      }));

      await Property.insertMany(docs, { ordered: false });
      console.log(`Migrated ${docs.length} properties`);
      process.exit(0);
    });
};

run().catch(console.error);
```

---

## 14. Frontend — Pages and State

### Redux slices (keep minimal)
Only two slices — `authSlice` (user + token) and `uiSlice` (loading, sidebar open). Everything else fetched with local state + useEffect or a lightweight hook. Don't over-engineer Redux.

```js
// store/authSlice.js
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: JSON.parse(localStorage.getItem('brokery_user')) || null,
    token: localStorage.getItem('brokery_token') || null,
  },
  reducers: {
    setCredentials: (state, action) => {
      state.user  = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem('brokery_token', action.payload.token);
      localStorage.setItem('brokery_user', JSON.stringify(action.payload.user));
    },
    logout: (state) => {
      state.user = null; state.token = null;
      localStorage.removeItem('brokery_token');
      localStorage.removeItem('brokery_user');
    }
  }
});
```

### Axios instance
```js
// api/axiosInstance.js
import axios from 'axios';
import store from '../store/store';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  const token = store.getState().auth.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

### Dashboard page layout
```
┌─────────────────────────────────────────────────┐
│  KPI Cards row (4 cards)                        │
│  [Total Clients] [Active Listings] [Closed] [Pending Approvals] │
├──────────────────────┬──────────────────────────┤
│  Deals by Month      │  Pipeline Distribution   │
│  (Bar chart)         │  (Donut chart)           │
├──────────────────────┼──────────────────────────┤
│  Broker Performance  │  Inventory by City       │
│  (Table)             │  (Horizontal bar chart)  │
└──────────────────────┴──────────────────────────┘
```
Charts: Recharts (`BarChart`, `PieChart`, `ResponsiveContainer`).

### Activity Log page layout
```
Filter bar: [Entity type dropdown] [Broker dropdown] [Date range]
─────────────────────────────────────────────────────
Timeline list (most recent first):
  🟢 Arjun Mehta   Created client Rahul Sharma        2h ago
  🔵 Admin         Approved change request #CR-041     3h ago
  🟡 Priya Sharma  Updated property 00AG interest level 5h ago
  🔴 Admin         Rejected change request #CR-040     Yesterday
```

---

## 15. Environment Variables

### backend/.env.example
```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/brokery
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

EMAIL_USER=youremail@gmail.com
EMAIL_PASS=your_gmail_app_password

CLIENT_URL=http://localhost:5173
```

### frontend/.env.example
```
VITE_API_URL=http://localhost:5000/api
```

---

## 16. Build Order (10-Day Plan)

> **Legend:**
> - 🔧 = Terminal command you run
> - 🔑 = Requires your credentials / manual action — do NOT use AI for this
> - 📖 = Read and understand before moving on
> - ✅ = Verify this works before committing
> - 💾 = Commit point

---

### Day 1 — Accounts, Credentials, Project Init

**Part A — External accounts setup** 🔑
These you do manually before writing any code:

1. **MongoDB Atlas**
   - Go to mongodb.com/cloud/atlas → create free cluster
   - Create database user (username + password — save these)
   - Whitelist IP: Network Access → Add IP → Allow from anywhere (0.0.0.0/0) for dev
   - Get connection string: Clusters → Connect → Drivers → copy URI
   - URI format: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/brokery`

2. **Cloudinary**
   - Go to cloudinary.com → sign up free
   - Dashboard shows: Cloud Name, API Key, API Secret — save all three

3. **Gmail App Password** (for Nodemailer)
   - Use your Gmail → Google Account → Security → 2-Step Verification → App Passwords
   - Create app password for "Mail" → copy the 16-character password
   - This is different from your Gmail login password

4. **GitHub repo**
   - Create new public repo named `Brokery` at github.com
   - Do NOT initialize with README (we'll push from local)

**Part B — Project setup** 🔧
```bash
# Create project root
mkdir "D:\Web Development\Brokery"
cd "D:\Web Development\Brokery"

# Create .gitignore BEFORE git init (copy from Section 2)
# Then:
git init
git remote add origin https://github.com/AbhiEE03/Brokery.git

# Backend init
mkdir backend
cd backend
npm init -y
npm install express mongoose bcryptjs jsonwebtoken dotenv cors multer cloudinary multer-storage-cloudinary csv-parser nodemailer
npm install --save-dev nodemon
```

**Part C — package.json scripts** — add manually:
```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

**Part D — Create .env** 🔑
Create `backend/.env` (never commit this):
```
PORT=5000
MONGO_URI=<your MongoDB Atlas URI from step 1>
JWT_SECRET=brokery_super_secret_key_2024
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=<from Cloudinary dashboard>
CLOUDINARY_API_KEY=<from Cloudinary dashboard>
CLOUDINARY_API_SECRET=<from Cloudinary dashboard>
EMAIL_USER=<your Gmail>
EMAIL_PASS=<your 16-char Gmail App Password>
CLIENT_URL=http://localhost:5173
```

**Part E — Create core files**
- `backend/config/db.js` — Mongoose connect with error handling
- `backend/server.js` — express app, CORS, JSON middleware, health route, connectDB call

✅ Run `npm run dev` → should see "Server started on port 5000" and "MongoDB connected"

💾
```bash
git add .
git commit -m "init: backend project setup with express and MongoDB"
git push -u origin main
```

---

### Day 2 — Frontend Init + All 7 Mongoose Models

**Part A — Frontend init** 🔧
```bash
cd "D:\Web Development\Brokery"
npm create vite@latest frontend -- --template react
cd frontend
npm install react-router-dom @reduxjs/toolkit react-redux axios recharts lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configure Tailwind — add to `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Configure `tailwind.config.js` content paths:
```js
content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]
```

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:5000/api
```

✅ Run `npm run dev` in frontend → Vite default page loads on localhost:5173

💾 `git commit -m "init: frontend vite react tailwind setup"`

**Part B — All 7 Mongoose Models**
Build in this order. 📖 Read each model after AI generates it — understand every field:

1. `models/User.js` — name, email, password (bcrypt), role enum, isActive
2. `models/Client.js` — clientCode (auto), name, phone, email, assignedBroker ref, pipelineStage enum, requirements subdoc, documents array, notes
3. `models/Property.js` — propertyCode (auto), title, propertyType, status, location subdoc, pricing subdoc, specs subdoc, dealer subdoc, images array, addedBy ref
4. `models/Match.js` — client ref, property ref, interestLevel enum, compound unique index
5. `models/ClientChangeRequest.js` — client ref, requestedBy ref, status enum, changes array [{field, oldValue, newValue}], adminNote, resolvedBy, resolvedAt
6. `models/PropertyChangeRequest.js` — same structure as above but property ref
7. `models/ActivityLog.js` — performedBy ref, action string, entity enum, entityId, metadata, createdAt index

💾 `git commit -m "feat: all 7 mongoose models"`

---

### Day 3 — Auth System

**Build in order:**

1. `middleware/authMiddleware.js`
   - `verifyToken` — extract Bearer token, jwt.verify, attach `req.user`
   - `requireAdmin` — check `req.user.role === 'admin'`
   - `requireBroker` — check role is admin or broker
   - 📖 Understand the 401 vs 403 distinction — 401 = not authenticated, 403 = authenticated but not authorized

2. `controllers/authController.js`
   - `register` — hash password with bcrypt, create User, return JWT (admin only route)
   - `login` — find user by email, bcrypt.compare, sign JWT with user id + role
   - `getMe` — return req.user from middleware

3. `routes/authRoutes.js`
   - POST `/api/auth/register` — requireAdmin middleware
   - POST `/api/auth/login` — public
   - GET `/api/auth/me` — verifyToken middleware

4. Wire routes in `server.js`:
   ```js
   app.use('/api/auth', require('./routes/authRoutes'));
   ```

✅ Test in Postman:
- POST `/api/auth/register` — should fail (no token) ✓
- Temporarily remove requireAdmin, register admin user, add it back
- POST `/api/auth/login` — should return token ✓
- GET `/api/auth/me` with Bearer token — should return user ✓

💾 `git commit -m "feat: JWT auth with role-based middleware"`

---

### Day 4 — Properties + Clients CRUD

**Part A — Code Generator** 📖
Build and test `utils/codeGenerator.js` in isolation before touching routes:
```bash
# Test it manually in node REPL:
node
> const { generateNextCode } = require('./utils/codeGenerator')
# Test with mock Property model
```
Understand the base-26 logic completely — you will be asked about this.

**Part B — Property routes**
- `controllers/propertyController.js`:
  - `createProperty` — generate code, create property, return with code
  - `getProperties` — with query filters: city, type, status, minPrice, maxPrice, minArea + pagination (page, limit, skip)
  - `getPropertyById` — populate addedBy
  - `deleteProperty` — admin only

- `routes/propertyRoutes.js` — wire all 4 routes with appropriate middleware

✅ Test: create 3 properties, verify codes are 00AA → 00AB → 00AC

💾 `git commit -m "feat: property CRUD with alphanumeric code generator"`

**Part C — Client routes**
- `controllers/clientController.js`:
  - `createClient` — auto clientCode (CL-000001 pattern using Counter or max+1 query), create client
  - `getClients` — admin sees all, broker sees own (filter by `assignedBroker: req.user._id`), with filters: stage, city, search by name
  - `getClientById` — populate assignedBroker
  - `deleteClient` — admin only

- `routes/clientRoutes.js`

✅ Test: create 2 clients, verify codes are CL-000001, CL-000002. Broker login → should only see own clients.

💾 `git commit -m "feat: client CRUD with pipeline stages and broker isolation"`

---

### Day 5 — Two-Tier Approval System + Matches

**Part A — Edit rules**
Create `utils/clientEditRules.js` and `utils/propertyEditRules.js` (see Section 5 of this document)

**Part B — Two-tier PATCH for clients**
`PATCH /api/clients/:id` logic:
1. Parse incoming body fields
2. Separate into `directFields` and `sensitiveFields` using clientEditRules
3. If directFields exist → `Client.findByIdAndUpdate(id, directFields)`
4. If sensitiveFields exist → read current values from DB, create `ClientChangeRequest` with `{field, oldValue, newValue}` for each
5. Return `{ updated: directResult, pending: changeRequestId }`

📖 This is the most important feature — read the controller logic until you can explain it without looking.

**Part C — ChangeRequest resolve route**
`PATCH /api/change-requests/:id/resolve` — admin only:
1. Find the ChangeRequest
2. If approved → apply all changes to the target document
3. Update ChangeRequest status, resolvedBy, resolvedAt
4. Trigger email notification (stub for now — wire Nodemailer in Day 6)
5. Return updated ChangeRequest

**Part D — Match routes**
- `POST /api/matches` — create match (client + property + interestLevel)
- `GET /api/matches/client/:clientId` — all properties matched to a client
- `GET /api/matches/property/:propertyId` — all clients matched to a property
- `PATCH /api/matches/:id` — update interest level
- `DELETE /api/matches/:id`

✅ Test full approval flow: broker edits budget → ChangeRequest created → admin approves → Client budget updated

💾 `git commit -m "feat: two-tier edit approval system"`
💾 `git commit -m "feat: property and client match engine"`

---

### Day 6 — Activity Log + Analytics + Email

**Part A — Activity Log**
- Build `middleware/logActivity.js` (see Section 9 of this document)
- Wire onto every write route (POST, PATCH, DELETE) in all route files
- `GET /api/activity` — paginated, admin sees all, broker sees own
- `GET /api/activity/entity/:entityId` — logs for one document

✅ Test: create a client → check ActivityLog collection in MongoDB Atlas — log entry should appear

💾 `git commit -m "feat: activity log middleware wired on all write routes"`

**Part B — Analytics endpoints**
Build all 5 aggregations from Section 7 of this document one by one:
- `GET /api/analytics/summary`
- `GET /api/analytics/deals-by-month`
- `GET /api/analytics/pipeline-distribution`
- `GET /api/analytics/broker-performance`
- `GET /api/analytics/property-by-city`

📖 Read each aggregation pipeline — understand every stage ($match, $group, $lookup, $project)

✅ Test each endpoint in Postman with admin token

💾 `git commit -m "feat: 5 analytics aggregation endpoints"`

**Part C — Email notifications** 🔑
- Build `utils/emailService.js` (see Section 8 of this document)
- Wire `sendChangeRequestResolved()` into the ChangeRequest resolve controller
- Test: approve a ChangeRequest → check your Gmail inbox for notification email
- ⚠️ If Gmail blocks it, make sure 2FA + App Password is set up correctly (Section 1 Day 1)

💾 `git commit -m "feat: nodemailer email notifications on change request resolution"`

---

### Day 7 — Frontend Core (Auth + Layout + Clients + Properties)

**Part A — Redux store + Axios**
- `store/store.js` — configureStore with authSlice
- `store/authSlice.js` — setCredentials, logout, localStorage persistence
- `api/axiosInstance.js` — baseURL from env, request interceptor attaches Bearer token

**Part B — Layout**
- `components/layout/Sidebar.jsx` — nav links: Dashboard, Clients, Properties, Matches, Change Requests, Activity Log. Admin-only links conditionally rendered based on Redux user role
- `components/layout/ProtectedRoute.jsx` — redirect to /login if no token in Redux store
- `App.jsx` — React Router setup with all routes wrapped in ProtectedRoute

**Part C — Auth page**
- `pages/Login.jsx` — email + password form, calls POST /api/auth/login, dispatches setCredentials, redirects to /dashboard

**Part D — Clients pages**
- `pages/Clients.jsx` — table with search bar, pipeline stage filter, paginated list. Broker sees own, admin sees all (handled by backend — frontend just calls the API)
- `pages/ClientDetail.jsx` — full client info, requirements, documents list, matches, edit form with two-tier logic (show "pending approval" badge for sensitive fields)

**Part E — Properties pages**
- `pages/Properties.jsx` — card/table view with city, type, status filters
- `pages/PropertyDetail.jsx` — full property info, images, edit form

✅ Full flow test: login → see clients list → click client → edit phone (direct) → edit budget (pending badge appears)

💾 `git commit -m "feat: frontend auth flow and sidebar layout"`
💾 `git commit -m "feat: clients and properties pages"`

---

### Day 8 — Frontend New Features (Dashboard + Activity Log + Change Requests)

**Part A — Dashboard**
- `pages/Dashboard.jsx` — 4 KPI cards + 4 charts (see layout in Section 14)
- Use Recharts: `BarChart` for deals by month, `PieChart` for pipeline distribution, custom table for broker performance, `BarChart` horizontal for inventory by city
- All data from analytics API endpoints built on Day 6

**Part B — Activity Log page**
- `pages/ActivityLog.jsx` — paginated timeline list, filter by entity type + broker + date range
- Each entry: avatar/initial, action text, entity badge, time ago (format with `formatters.js`)

**Part C — Change Requests page**
- `pages/ChangeRequests.jsx` — broker view: list of own pending requests with status badges. Admin view: all pending requests with visual diff (old value → new value) and Approve/Reject buttons

**Part D — Matches page**
- `pages/Matches.jsx` — table of all client-property links with interest level badges, ability to add new match

✅ Full test: open Dashboard → all charts render with real data → approve a change request → email arrives → activity log shows the action

💾 `git commit -m "feat: dashboard analytics with recharts"`
💾 `git commit -m "feat: activity log page and change requests management UI"`

---

### Day 9 — Cloudinary Upload + Seed Data

**Part A — Cloudinary document upload** 🔑
- Build `config/cloudinary.js` — init with credentials from .env (already set on Day 1)
- Build `middleware/uploadMiddleware.js` — multer + cloudinary storage, accept pdf/images, 5MB limit
- Wire onto `POST /api/clients/:id/documents` and `POST /api/properties/:id/images`
- Frontend: add file upload input on ClientDetail and PropertyDetail pages

✅ Test: upload a PDF for a client → URL stored in MongoDB → displays in UI

💾 `git commit -m "feat: cloudinary document and image upload"`

**Part B — Seed script** 🔑
- Build `scripts/seed.js`
- Seed data: 4 users (1 admin + 3 brokers), 20 properties across Delhi/Mumbai/Bangalore/Hyderabad, 15 clients across all pipeline stages, 8-10 matches
- Spread `closed` deals across last 6 months so the monthly chart looks good
- Run: `node scripts/seed.js`
- ✅ Open MongoDB Atlas → verify all collections have data
- ✅ Open Dashboard in browser → all 4 charts should show real data

💾 `git commit -m "chore: seed script with fake metro cities real estate data"`

---

### Day 10 — Deploy + README + Final Polish

**Part A — Final code sweep**
- Remove all `console.log` statements (except intentional ones in seed/migrate scripts)
- Verify all `.env` variables are in `.env.example` with placeholder values
- Check no hardcoded credentials anywhere in code
- Run both frontend and backend locally one final time — test every feature

💾 `git commit -m "refactor: remove console logs and cleanup before deploy"`

**Part B — Deploy Backend to Render** 🔑
1. Go to render.com → New → Web Service → connect GitHub → select Brokery repo
2. Settings:
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `node server.js`
3. Environment variables — add ALL from your `.env` file one by one 🔑
4. Deploy → wait for build to complete
5. Copy the Render URL (e.g. `https://brokery-api.onrender.com`)

**Part C — Deploy Frontend to Vercel** 🔑
1. Go to vercel.com → New Project → import Brokery repo
2. Settings:
   - Root directory: `frontend`
   - Framework: Vite
3. Environment variables:
   - `VITE_API_URL` = `https://brokery-api.onrender.com/api` (your Render URL)
4. Deploy → copy Vercel URL

**Part D — Update CORS on backend** 🔑
Update `CLIENT_URL` env var on Render to your Vercel URL, and update server.js CORS config:
```js
cors({ origin: process.env.CLIENT_URL, credentials: true })
```
Redeploy backend on Render after this change.

✅ Full end-to-end test on live URLs:
- Login with seed admin credentials
- Create a client, upload a document
- Approve a change request → check email
- Open Dashboard → all charts work

**Part E — README** 📖
Write `README.md` at root. Must include:
```
## Brokery CRM
[1-para description]

## Live Demo
Frontend: https://brokery.vercel.app
Backend API: https://brokery-api.onrender.com

## Demo Credentials
Admin:   admin@brokery.com  / Admin@1234
Broker1: arjun@brokery.com  / Broker@1234

## Features
[bullet list of all 6 features]

## Tech Stack
[list]

## Architecture
[brief explanation of two-tier approval and state machine]

## Local Setup
[step by step from clone to running locally]
```

💾 `git commit -m "docs: README with live links and demo credentials"`
💾 `git push origin main`

---

> **Important notes across all days:**
> - Never commit `.env` — if you accidentally do, rotate all credentials immediately
> - If you get stuck on a feature for more than 30 minutes, ask Claude — don't waste time
> - After each day, close laptop and explain what you built out loud — if you can't, re-read the code
> - Keep GitHub Copilot/Claude Code suggestions at arm's length — read before accepting, always

---

## 17. Dependencies

### Backend
```json
{
  "dependencies": {
    "express": "^4.18",
    "mongoose": "^8",
    "bcryptjs": "^2.4",
    "jsonwebtoken": "^9",
    "dotenv": "^16",
    "cors": "^2.8",
    "multer": "^1.4",
    "cloudinary": "^2",
    "multer-storage-cloudinary": "^4",
    "csv-parser": "^3",
    "nodemailer": "^6"
  },
  "devDependencies": {
    "nodemon": "^3"
  }
}
```
Install dev dependency: `npm install --save-dev nodemon`

Add to `package.json` scripts:
```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```
Run in development with `npm run dev` — auto-restarts on file changes.

### Frontend
```json
{
  "react": "^18",
  "react-dom": "^18",
  "react-router-dom": "^6",
  "@reduxjs/toolkit": "^2",
  "react-redux": "^9",
  "axios": "^1.6",
  "recharts": "^2.10",
  "tailwindcss": "^3",
  "lucide-react": "latest"
}
```

---

## 18. Interview Talking Points

These are the things you should be able to explain without looking at code:

**Two-tier approval system:**
> "Brokers can edit low-risk fields like notes or phone directly. Sensitive fields like budget or pipeline stage go into a ChangeRequest document. Admin reviews the diff and approves or rejects. On approval the system applies the changes to the actual document. This prevents unauthorized pipeline manipulation."

**Property code generator:**
> "It's a base-26 encoding on the letter suffix with a 2-digit numeric prefix. The system queries the highest existing code, decodes it, increments by one, and re-encodes. When letters roll over from ZZ, the numeric prefix increments — so 00ZZ becomes 01AA. It's deterministic and collision-safe because it always reads the current max before generating."

**Analytics aggregation:**
> "The dashboard uses MongoDB aggregation pipelines. For broker performance I use $group to count total clients and conditionally sum closed deals per broker, then $lookup to join the user name. For monthly trends I match on pipelineStage=closed and group by year+month using $year and $month operators."

**Activity log middleware:**
> "I wrote a middleware factory that wraps res.json. After the controller sends a successful response, it creates an ActivityLog document with the user, action string, entity type, and entity ID. It never blocks the response — errors are caught and logged to console only."

---

*Document ends. Start with Day 1 and commit as you go.*
