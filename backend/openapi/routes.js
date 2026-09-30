/**
 * Every API route, described once. The request schemas are the same Zod
 * objects the routes validate with, so the docs can't drift from what the
 * server accepts. tests/openapi.test.js checks each path is a real route.
 *
 * auth: "public" | "user" (any signed-in user) | "admin"
 */
const s = require("../validation/schemas");

const routes = [
	// ---- auth
	{ method: "post", path: "/auth/login", tag: "Auth", auth: "public", summary: "Sign in; returns a JWT", body: s.loginBody },
	{ method: "get", path: "/auth/me", tag: "Auth", auth: "user", summary: "The signed-in user" },
	{ method: "post", path: "/auth/register", tag: "Auth", auth: "admin", summary: "Create a user account (audited)", body: s.registerBody },
	{ method: "get", path: "/auth/brokers", tag: "Auth", auth: "admin", summary: "List brokers" },

	// ---- clients
	{ method: "get", path: "/clients", tag: "Clients", auth: "user", summary: "List clients (brokers: their own)", query: s.listClientsQuery },
	{ method: "post", path: "/clients", tag: "Clients", auth: "user", summary: "Create a client; a phone number already registered by another broker returns 409 and opens an ownership claim", body: s.createClientBody },
	{ method: "get", path: "/clients/{id}", tag: "Clients", auth: "user", summary: "One client (owner or admin)", params: s.idParams },
	{ method: "patch", path: "/clients/{id}", tag: "Clients", auth: "user", summary: "Edit a client: low-risk fields apply now, sensitive fields become a change request (202)", params: s.idParams, body: s.updateClientBody },
	{ method: "delete", path: "/clients/{id}", tag: "Clients", auth: "admin", summary: "Soft-delete a client (removes its matches, withdraws pending requests)", params: s.idParams },
	{ method: "post", path: "/clients/{id}/documents", tag: "Clients", auth: "user", summary: "Upload a document (multipart field `file`; PDF/JPG/PNG/WebP up to 5 MB, checked by content)", params: s.idParams, multipart: true },
	{ method: "get", path: "/clients/{id}/recommendations", tag: "Matching", auth: "user", summary: "Top-k properties for this client, each with a score and reasons", params: s.idParams, query: s.recommendationsQuery },
	{ method: "post", path: "/clients/{id}/recommendations/{propertyId}/link", tag: "Matching", auth: "user", summary: "Create a match from a recommendation", params: s.recommendationParams, body: s.linkRecommendationBody },
	{ method: "post", path: "/clients/{id}/recommendations/{propertyId}/dismiss", tag: "Matching", auth: "user", summary: "Hide a recommendation for this client (\"not a fit\")", params: s.recommendationParams, body: s.dismissRecommendationBody },
	{ method: "get", path: "/clients/{id}/shortlists", tag: "Shortlists", auth: "user", summary: "Shortlist links sent to this client, with opens and reactions", params: s.idParams },
	{ method: "post", path: "/clients/{id}/shortlists", tag: "Shortlists", auth: "user", summary: "Create an expiring shortlist link; the URL is returned once", params: s.idParams, body: s.createShortlistBody },

	// ---- properties
	{ method: "get", path: "/properties", tag: "Properties", auth: "user", summary: "List properties; `search` is relevance-ranked full text with a substring fallback", query: s.listPropertiesQuery },
	{ method: "post", path: "/properties", tag: "Properties", auth: "user", summary: "Create a property (emits a re-match event)", body: s.createPropertyBody },
	{ method: "get", path: "/properties/{id}", tag: "Properties", auth: "user", summary: "One property", params: s.idParams },
	{ method: "patch", path: "/properties/{id}", tag: "Properties", auth: "user", summary: "Edit a property (adder or admin); sensitive fields go through approval", params: s.idParams, body: s.updatePropertyBody },
	{ method: "delete", path: "/properties/{id}", tag: "Properties", auth: "admin", summary: "Soft-delete a property", params: s.idParams },
	{ method: "post", path: "/properties/{id}/images", tag: "Properties", auth: "user", summary: "Upload an image (multipart field `file`)", params: s.idParams, multipart: true },
	{ method: "get", path: "/properties/{id}/interested-clients", tag: "Matching", auth: "user", summary: "Active clients this property suits (brokers: their own)", params: s.idParams, query: s.recommendationsQuery },

	// ---- matches
	{ method: "get", path: "/matches", tag: "Matches", auth: "user", summary: "Client↔property links visible to you", query: s.listMatchesQuery },
	{ method: "post", path: "/matches", tag: "Matches", auth: "user", summary: "Link one of your clients to a property", body: s.createMatchBody },
	{ method: "get", path: "/matches/client/{clientId}", tag: "Matches", auth: "user", summary: "Links for one client" },
	{ method: "get", path: "/matches/property/{propertyId}", tag: "Matches", auth: "user", summary: "Links for one property (scoped to your clients)" },
	{ method: "patch", path: "/matches/{id}", tag: "Matches", auth: "user", summary: "Change interest level or notes", params: s.idParams, body: s.updateMatchBody },
	{ method: "delete", path: "/matches/{id}", tag: "Matches", auth: "user", summary: "Remove a link", params: s.idParams },

	// ---- approvals
	{ method: "get", path: "/change-requests", tag: "Approvals", auth: "user", summary: "Change requests (brokers: their own); `status=resolved` for history; conflicts include current values", query: s.listChangeRequestsQuery },
	{ method: "get", path: "/change-requests/{id}", tag: "Approvals", auth: "user", summary: "One change request", params: s.idParams },
	{ method: "post", path: "/change-requests/{id}/approve", tag: "Approvals", auth: "admin", summary: "Approve exactly once; a stale request becomes `conflict` instead", params: s.idParams, body: s.decisionBody },
	{ method: "post", path: "/change-requests/{id}/reject", tag: "Approvals", auth: "admin", summary: "Reject", params: s.idParams, body: s.decisionBody },
	{ method: "post", path: "/change-requests/{id}/withdraw", tag: "Approvals", auth: "user", summary: "Withdraw your own pending request", params: s.idParams },
	{ method: "patch", path: "/change-requests/{id}/resolve", tag: "Approvals", auth: "admin", summary: "Deprecated alias of approve/reject", params: s.idParams, body: s.resolveChangeRequestBody, deprecated: true },

	// ---- ownership
	{ method: "get", path: "/ownership-claims", tag: "Ownership", auth: "admin", summary: "Duplicate-registration claims with audit evidence", query: s.listOwnershipClaimsQuery },
	{ method: "post", path: "/ownership-claims/{id}/resolve", tag: "Ownership", auth: "admin", summary: "Keep with the current broker or transfer to the claimant", params: s.idParams, body: s.resolveOwnershipClaimBody },

	// ---- shortlists
	{ method: "delete", path: "/shortlists/{id}", tag: "Shortlists", auth: "user", summary: "Revoke a link (creator, the client's broker or an admin)", params: s.idParams },
	{ method: "get", path: "/public/shortlists/{token}", tag: "Public", auth: "public", summary: "The buyer's view of a shortlist (allow-listed fields). Unknown, expired and revoked links all return 404" },
	{ method: "post", path: "/public/shortlists/{token}/feedback", tag: "Public", auth: "public", summary: "Buyer reaction to one property; idempotent per (link, property)", body: s.shortlistFeedbackBody },

	// ---- audit & alerts
	{ method: "get", path: "/activity", tag: "Audit", auth: "user", summary: "Audit feed (brokers: their own actions); keyset pagination with `cursor`", query: s.listActivityQuery },
	{ method: "get", path: "/activity/entity/{entityId}", tag: "Audit", auth: "user", summary: "History of one client or property", params: s.entityParams, query: s.listActivityQuery },
	{ method: "get", path: "/activity/verify", tag: "Audit", auth: "admin", summary: "Recompute the hash chain; reports the first broken entry" },
	{ method: "get", path: "/alerts", tag: "Alerts", auth: "user", summary: "Your in-app alerts (new matches, buyer reactions)", query: s.listAlertsQuery },
	{ method: "post", path: "/alerts/{id}/read", tag: "Alerts", auth: "user", summary: "Mark one alert read", params: s.idParams },
	{ method: "post", path: "/alerts/read-all", tag: "Alerts", auth: "user", summary: "Mark all your alerts read" },

	// ---- analytics & meta
	{ method: "get", path: "/analytics/summary", tag: "Analytics", auth: "admin", summary: "KPI totals" },
	{ method: "get", path: "/analytics/deals-by-month", tag: "Analytics", auth: "admin", summary: "Closures per month (from stage events)" },
	{ method: "get", path: "/analytics/pipeline-distribution", tag: "Analytics", auth: "admin", summary: "Clients per stage" },
	{ method: "get", path: "/analytics/broker-performance", tag: "Analytics", auth: "admin", summary: "Per-broker closed, lost, open and conversion" },
	{ method: "get", path: "/analytics/property-by-city", tag: "Analytics", auth: "admin", summary: "Inventory per city" },
	{ method: "get", path: "/analytics/funnel", tag: "Analytics", auth: "admin", summary: "Cumulative stage funnel" },
	{ method: "get", path: "/analytics/time-in-stage", tag: "Analytics", auth: "admin", summary: "Median days per stage" },
	{ method: "get", path: "/meta/edit-policies", tag: "Meta", auth: "user", summary: "Which fields apply directly and which need approval" },
];

module.exports = { routes };
