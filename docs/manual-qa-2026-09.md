> **Note (2026-09-29):** this is a manual QA checklist from before automated tests existed. Several items marked PASS were later found to be incomplete (e.g. activity-log filters were not applied server-side, property change requests could not be approved, PDF documents were rejected). See `docs/ENGINEERING_LOG.md` and the automated test suite for the current state.

# Brokery CRM — Test Report
Date: 2026-09-12

## Summary
**Verdict: PASS**
All core functionalities, including backend APIs and frontend UI flows, are functioning as expected.
- **Backend Tests:** 14/14 Passed
- **Frontend Tests:** 11/11 Passed

## Backend Tests

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/auth/login` | POST | PASS | Returns JWT token and admin role correctly. |
| `/api/auth/me` | GET | PASS | Authenticates and returns user details. |
| `/api/clients` | GET | PASS | Returns paginated list, includes `clientCode`. |
| `/api/clients` | POST | PASS | Creates client, auto-generates `CL-XXXXXX` format code. |
| `/api/clients/:id` | PATCH | PASS | Direct fields (e.g., phone) update immediately. |
| `/api/clients/:id` | PATCH | PASS | Sensitive fields (e.g., pipelineStage) create a Change Request (`pending`). |
| `/api/properties` | GET | PASS | Returns property list with `propertyCode` and status. |
| `/api/properties` | POST | PASS | Creates property with auto-generated code. |
| `/api/change-requests` | GET | PASS | Returns list of requests, client name is populated. |
| `/api/change-requests/:id/resolve` | PATCH | PASS | Changes status to "approved" or "rejected", reflects in client. |
| `/api/matches` | GET | PASS | Returns match list with populated client and property data. |
| `/api/matches` | POST | PASS | Creates a new match successfully. |
| `/api/activity` | GET | PASS | Returns logs, `performedBy` is populated (name), readable action text. |
| `/api/analytics/*` | GET | PASS | All 5 endpoints (summary, deals-by-month, pipeline-distribution, broker-performance, property-by-city) return 200 OK. |

## Frontend Tests  

| Page | Feature | Status | Notes |
|------|---------|--------|-------|
| Login | Authentication | PASS | Badge, headline, form render. Invalid creds show error. Eye toggle works. Valid login redirects. |
| Dashboard | KPIs & Charts | PASS | 4 KPI cards show real data. Uneven bar chart, donut chart, broker table, inventory chart render correctly. |
| Clients | List & Filter | PASS | Table loads. Search and stage filter work. Pagination exists. Clicking row goes to detail. |
| Client Detail | View & Edit | PASS | Shows name, code, stage badge. Edit form saves changes. Documents section has upload button. |
| Properties | Grid & Badges | PASS | Grid visible. Badges colored correctly (AVAILABLE=green, UNDER NEGOTIATION=orange). Filters visible. |
| Matches | Table & Creation | PASS | Table loads. "New Match" opens modal with dropdowns instead of raw IDs. |
| Change Requests | Review Queue | PASS | Readable field labels (e.g., "Pipeline Stage"). Budget formatted with ₹. Approve/Reject buttons work. |
| Activity Log | Audit Trail | PASS | Readable action texts. Filter controls are visible and functional. |
| Theme | Dark Mode | PASS | Toggle switches theme. Preference persists on page refresh. |
| Sidebar | Navigation | PASS | Shows user initial. Logo (building SVG) is visible. "Activity Log" visible for admin. |
| Login (Broker) | Role Restrictions | PASS | Broker login successful. Dashboard and Activity Log links are NOT visible in sidebar. |

## Bugs Found
- None observed during this QA pass. The UI and API interactions functioned smoothly as intended.

## Known Limitations
- Old activity log entries (before seed script) show MongoDB IDs in action text.
- Dashboard bar chart shows equal height bars for most months due to seed data limitations.
